import os
import subprocess
import tempfile
from pathlib import Path
from typing import Literal, TypedDict

from .logger import logger

RUN_TIMEOUT_SECONDS = 5


class SuccessResult(TypedDict):
    status: Literal["success"]


class FailureResult(TypedDict):
    status: Literal["failure"]
    referenceOutput: str
    inputOutput: str


class ErrorResult(TypedDict):
    status: Literal["error"]
    message: str


class RunCompleted(TypedDict):
    """One executor-script run that actually finished, however it exited."""

    status: Literal["completed"]
    exitCode: int
    stdout: str
    stderr: str


ExecutionResult = SuccessResult | FailureResult | ErrorResult
RunResult = RunCompleted | ErrorResult

_NO_EXECUTOR_SCRIPT_MESSAGE = (
    "This note has no Executor Script, so there is nothing to run the code with. "
    "Add one that runs $ACE_CODE_FILE and prints its output."
)


_ACE_ENV_VARS = ("ACE_CODE_FILE", "ACE_REFERENCE_CODE_FILE", "ACE_INPUT_CODE_FILE")


def _run_executor_script(
    executor_script_path: Path, cwd: Path, extra_env: dict[str, str]
) -> subprocess.CompletedProcess[str]:
    # Inherit Anki's environment rather than replacing it: handing subprocess an env=
    # of just the ACE_* variables leaves the script with no PATH, so bash falls back to
    # a built-in default of /usr/local/sbin:/usr/local/bin:/usr/bin and every
    # interpreter installed by a version manager (mise, pyenv, nvm, asdf, conda) or
    # into ~/.local/bin becomes invisible -- or worse, silently resolves to a different
    # system-wide version than the one the card author tested against.
    #
    # Ambient ACE_* variables are dropped first so that "only set while running the
    # reference/input code" stays true even if Anki itself was launched with them set.
    env = {name: value for name, value in os.environ.items() if name not in _ACE_ENV_VARS}
    env.update(extra_env)

    return subprocess.run(
        ["bash", str(executor_script_path)],
        cwd=cwd,
        env=env,
        capture_output=True,
        text=True,
        timeout=RUN_TIMEOUT_SECONDS,
    )


def compare_reference_and_input_code(
    reference_code: str, input_code: str, executor_script: str
) -> ExecutionResult:
    """Run `executor_script` (bash) once against the reference code and once against
    the user's input code, each in its own injected $ACE_CODE_FILE, and compare stdout.
    """
    # Without this, both runs produce no output at all, those outputs compare equal,
    # and the card reports success no matter what was typed -- which is the state every
    # note is in until its Executor Script has been filled in.
    if not executor_script.strip():
        return {"status": "error", "message": _NO_EXECUTOR_SCRIPT_MESSAGE}

    try:
        with tempfile.TemporaryDirectory(prefix="ace-run-") as tmpdir_name:
            tmpdir = Path(tmpdir_name)

            reference_code_file = tmpdir / "reference_code"
            reference_code_file.write_text(reference_code)

            input_code_file = tmpdir / "input_code"
            input_code_file.write_text(input_code)

            executor_script_file = tmpdir / "executor.sh"
            executor_script_file.write_text(executor_script)

            reference_run = _run_executor_script(
                executor_script_file,
                tmpdir,
                {
                    "ACE_CODE_FILE": str(reference_code_file),
                    "ACE_REFERENCE_CODE_FILE": str(reference_code_file),
                },
            )
            if reference_run.returncode != 0:
                return {
                    "status": "error",
                    "message": f"Reference code run exited with status "
                    f"{reference_run.returncode}: {reference_run.stderr}",
                }

            input_run = _run_executor_script(
                executor_script_file,
                tmpdir,
                {
                    "ACE_CODE_FILE": str(input_code_file),
                    "ACE_INPUT_CODE_FILE": str(input_code_file),
                },
            )
            if input_run.returncode != 0:
                return {
                    "status": "error",
                    "message": f"Input code run exited with status "
                    f"{input_run.returncode}: {input_run.stderr}",
                }

            reference_output = reference_run.stdout.rstrip()
            input_output = input_run.stdout.rstrip()

            if reference_output == input_output:
                return {"status": "success"}

            return {
                "status": "failure",
                "referenceOutput": reference_output,
                "inputOutput": input_output,
            }
    except subprocess.TimeoutExpired:
        return {
            "status": "error",
            "message": f"Execution timed out after {RUN_TIMEOUT_SECONDS} seconds",
        }
    except OSError as error:
        logger.exception("Unexpected error while running executor script")
        return {"status": "error", "message": str(error)}


def run_reference_code(reference_code: str, executor_script: str) -> RunResult:
    """Run `executor_script` once against the reference code and report everything it
    produced -- stdout, stderr and exit status.

    This backs the editor's "Run Reference Code" button. Unlike the review-time
    comparison it does not treat a non-zero exit as an error to be summarised away:
    a failing compile is exactly what the card's author is looking for, so the
    stderr and the exit code are the useful part of the answer.
    """
    if not executor_script.strip():
        return {"status": "error", "message": _NO_EXECUTOR_SCRIPT_MESSAGE}

    try:
        with tempfile.TemporaryDirectory(prefix="ace-run-") as tmpdir_name:
            tmpdir = Path(tmpdir_name)

            reference_code_file = tmpdir / "reference_code"
            reference_code_file.write_text(reference_code)

            executor_script_file = tmpdir / "executor.sh"
            executor_script_file.write_text(executor_script)

            run = _run_executor_script(
                executor_script_file,
                tmpdir,
                {
                    "ACE_CODE_FILE": str(reference_code_file),
                    "ACE_REFERENCE_CODE_FILE": str(reference_code_file),
                },
            )

            return {
                "status": "completed",
                "exitCode": run.returncode,
                "stdout": run.stdout.rstrip(),
                "stderr": run.stderr.rstrip(),
            }
    except subprocess.TimeoutExpired:
        return {
            "status": "error",
            "message": f"Execution timed out after {RUN_TIMEOUT_SECONDS} seconds",
        }
    except OSError as error:
        logger.exception("Unexpected error while running executor script")
        return {"status": "error", "message": str(error)}

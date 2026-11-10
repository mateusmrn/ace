import subprocess
import tempfile
from pathlib import Path
from typing import Literal, TypedDict

from ace.logger import logger

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


ExecutionResult = SuccessResult | FailureResult | ErrorResult


def _run_executor_script(
    executor_script_path: Path, cwd: Path, extra_env: dict[str, str]
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["bash", str(executor_script_path)],
        cwd=cwd,
        env=extra_env,
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

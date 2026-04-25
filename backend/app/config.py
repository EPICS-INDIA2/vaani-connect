"""Environment and Hugging Face login helpers.

The backend model loaders call this file before downloading models from
Hugging Face. Future maintainers should keep the accepted environment variable
names in sync with the deployment docs and backend README.
"""

import os

from huggingface_hub import login


def load_hf_token() -> str:
    """Read Hugging Face token from environment variables."""
    # Both names are supported because different Hugging Face tools document
    # different variable names. Removing one can break an existing deployment.
    token = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_HUB_TOKEN")
    if not token:
        raise ValueError(
            "HF token is missing. Set HF_TOKEN or HUGGINGFACE_HUB_TOKEN before starting the backend."
        )
    return token


def login_huggingface() -> str:
    """Login to Hugging Face Hub and return the active token."""
    token = load_hf_token()
    # Set both variables so downstream libraries see the same token even if
    # they look for only one of the names.
    os.environ["HF_TOKEN"] = token
    os.environ["HUGGINGFACE_HUB_TOKEN"] = token
    login(token=token)
    return token

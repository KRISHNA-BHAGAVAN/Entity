class BYOKError(ValueError):
    """Base class for BYOK-related failures."""


class BYOKRequiredError(BYOKError):
    """Raised when a user has no active BYOK configuration."""


class BYOKSetupRequiredError(BYOKError):
    """Raised when no usable provider configuration can be resolved."""


class ProviderValidationError(BYOKError):
    """Raised when provider credentials or model validation fails."""


__all__ = [
    "CredentialBroker",
    "get_provider_adapter",
    "get_provider_catalog",
    "get_provider_spec",
    "key_broker",
]


def __getattr__(name):
    if name in {"CredentialBroker", "key_broker"}:
        from .broker import CredentialBroker, key_broker

        exports = {
            "CredentialBroker": CredentialBroker,
            "key_broker": key_broker,
        }
        return exports[name]

    if name in {"get_provider_adapter", "get_provider_catalog", "get_provider_spec"}:
        from .registry import get_provider_adapter, get_provider_catalog, get_provider_spec

        exports = {
            "get_provider_adapter": get_provider_adapter,
            "get_provider_catalog": get_provider_catalog,
            "get_provider_spec": get_provider_spec,
        }
        return exports[name]

    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

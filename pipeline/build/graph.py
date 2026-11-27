"""Minimal deterministic builder DAG with missing-dependency/cycle detection."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable


@dataclass(frozen=True)
class Builder:
    name: str
    requires: tuple[str, ...]
    produces: str
    run: Callable[[], None]


def execute(builders: list[Builder], available: set[str] | None = None) -> list[str]:
    available = set(available or ())
    produced = set()
    for builder in builders:
        if builder.produces in available or builder.produces in produced:
            raise ValueError(f"DUPLICATE_BUILD_OUTPUT:{builder.produces}")
        produced.add(builder.produces)
    pending = list(builders)
    executed = []
    while pending:
        ready = sorted([b for b in pending if set(b.requires).issubset(available)],
                       key=lambda b: (b.produces, b.name))
        if not ready:
            unresolved = ";".join(f"{b.name}:{','.join(b.requires)}" for b in pending)
            raise ValueError("MISSING_DEPENDENCY_OR_CYCLE:" + unresolved)
        for b in ready:
            b.run()
            available.add(b.produces)
            executed.append(b.name)
            pending.remove(b)
    return executed

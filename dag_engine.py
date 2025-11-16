# dag_engine.py
from __future__ import annotations
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from enum import Enum
from inspect import signature, isclass
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, Type
import threading
import time
import uuid

# ---------------- event system ----------------
class EventType(str, Enum):
    NODE_OK = "NODE_OK"

class EventBus:
    def __init__(self):
        self._subs = {}

    def subscribe(self, ev, fn):
        self._subs.setdefault(ev, []).append(fn)

    def publish(self, ev, data):
        for fn in self._subs.get(ev, []):
            fn(data)

# ---------------- registry ----------------
@dataclass
class NodeMeta:
    name: str
    cls: Type
    depends_on: Tuple[str, ...]

_NODE_REGISTRY = {}
_INJECT_FIELDS = {}

def node(name=None, depends_on=()):
    def deco(cls):
        nm = name or cls.__name__
        _NODE_REGISTRY[nm] = NodeMeta(nm, cls, tuple(depends_on))
        return cls
    return deco

def inject(cls):
    _INJECT_FIELDS[cls] = set(getattr(cls, "__annotations__", {}).keys())
    return cls

# ---------------- execution ----------------
@dataclass
class WorkflowContext:
    id: str
    inputs: Dict[str, Any]
    store: Dict[str, Any] = field(default_factory=dict)
    lock: threading.Lock = field(default_factory=threading.Lock)
class DagEngine:
    def run(self, inputs: Dict[str, Any]):
        ctx = WorkflowContext(str(uuid.uuid4()), inputs)
        instances = {name: meta.cls() for name, meta in _NODE_REGISTRY.items()}

        # inject ctx
        for name, meta in _NODE_REGISTRY.items():
            obj = instances[name]
            for f in _INJECT_FIELDS.get(meta.cls, []):
                if getattr(meta.cls, "__annotations__", {}).get(f) is WorkflowContext:
                    setattr(obj, f, ctx)

        results = {}

        # repeat until all nodes are executed
        remaining = set(_NODE_REGISTRY.keys())

        while remaining:
            progressed = False

            for name in list(remaining):
                meta = _NODE_REGISTRY[name]

                # toate dependențele trebuie să fie executate
                if all(dep in results for dep in meta.depends_on):
                    obj = instances[name]
                    res = obj.run(ctx)
                    ctx.store[name] = res
                    results[name] = res
                    remaining.remove(name)
                    progressed = True

            if not progressed:
                raise RuntimeError("Deadlock in DAG – verifică dependințele.")

        return results

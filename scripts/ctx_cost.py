#!/usr/bin/env python3
"""Цена контекста: сколько токенов стоит файл в промпте.

    ctx_cost.py [--cap N] FILE [FILE...]

Перенесён из набора agent-kit (bin/ctx-cost) и переписан так, чтобы работать без
bash и без локального cliproxy: tiktoken, если установлен, иначе оценка по
символам. Потолки из правил набора: AGENTS.md и HANDOFF.md — по 2k токенов,
список скиллов — 1k, тело SKILL.md — 2k.

Правило проекта: AGENTS.md не больше 2000 токенов. Всё, что не влезает, живёт в
скиллах и читается по требованию, а не платится на каждом шаге модели.
"""
import argparse
import sys

CHARS_PER_TOKEN = 3.1  # оценка для ru/en от набора agent-kit
CAP_DEFAULT = 2000


def encoder():
    try:
        import tiktoken
    except ImportError:
        return None
    return tiktoken.get_encoding("o200k_base")


def main():
    ap = argparse.ArgumentParser(description="Цена файла в контексте, токенов")
    ap.add_argument("--cap", type=int, default=CAP_DEFAULT, help="потолок на файл, токенов")
    ap.add_argument("--no-cap", action="store_true", help="не сравнивать с потолком")
    ap.add_argument("files", nargs="+")
    args = ap.parse_args()

    # Windows: консоль по умолчанию cp1251 — кириллица в таблице иначе падает.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass

    enc = encoder()
    source = "tiktoken (o200k_base)" if enc else f"оценка по символам (~{CHARS_PER_TOKEN} симв/токен)"
    cap = None if args.no_cap else args.cap

    rows, over = [], 0
    for name in args.files:
        try:
            with open(name, encoding="utf-8", errors="replace") as fh:
                text = fh.read()
        except OSError as exc:
            print(f"{name}: {exc}", file=sys.stderr)
            continue
        tokens = len(enc.encode(text)) if enc else round(len(text) / CHARS_PER_TOKEN)
        rows.append((name, tokens))
        if cap and tokens > cap:
            over += 1

    head = f"{'файл':<46}{'токенов':>9}"
    print(head + (f"{'потолок':>10}" if cap else ""))
    print("-" * (len(head.encode()) + (10 if cap else 0)))
    for name, tokens in rows:
        line = f"{name[:45]:<46}{tokens:>9}"
        if cap:
            line += f"{tokens - cap:>+10}" if tokens > cap else f"{'ok':>10}"
        print(line)
    print("-" * (len(head.encode()) + (10 if cap else 0)))
    print(f"{source}")
    if over:
        print(f"выше потолка: {over} из {len(rows)} — детали перенести в скиллы")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

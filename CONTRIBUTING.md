# Contributing to HabitCraft

Thanks for your interest in HabitCraft.

## License

HabitCraft is licensed under the [GNU Affero General Public License v3.0](LICENSE)
(AGPL-3.0-only). If you run a modified version of HabitCraft as a network
service, the AGPL requires you to offer your modified source to its users.

## Contributor License Agreement

HabitCraft's core packages are designed to be embedded by other applications,
and the copyright holder also uses them in a commercial product. So that
contributions can be used in both, **outside contributors must sign a
Contributor License Agreement (CLA) before a pull request can be merged.** The
CLA lets the copyright holder distribute your contribution under other terms as
well as under the AGPL. You keep the copyright in your contribution.

The CLA signing process is being set up. Until it's in place, please open an
issue to discuss a change before sending a pull request.

## How we work

- The trunk is `master`; see [CLAUDE.md](CLAUDE.md) for the workflow.
- Test-driven, with acceptance tests first: a user-facing change starts with a
  failing acceptance test written in domain language. See
  [docs/TESTING.md](docs/TESTING.md).
- `scripts/test-all.sh` runs every gate that CI runs.

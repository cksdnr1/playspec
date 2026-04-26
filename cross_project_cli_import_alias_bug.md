Observed cross-project CLI bug:

Running PlaySpec from another project fails:

/volume2/PJ/AliveSolution [master] % playspec init

TypeError [ERR_PACKAGE_IMPORT_NOT_DEFINED]:
Package import specifier "#core/errors.js" is not defined in package /volume2/PJ/playspec/package.json
imported from /volume2/PJ/playspec/src/cli/index.ts

Root cause:
PlaySpec source uses package import aliases such as "#core/errors.js", but package.json does not define matching "imports" entries for those aliases.

Expected:
PlaySpec CLI must work from any project directory after installation/linking, not only inside the PlaySpec repo.

Required fix:
- Add package.json "imports" mappings for all runtime source aliases used by src.
- Verify `playspec init` works from an external project directory.
- Add regression test or smoke script for cross-project CLI execution if practical.
- Long-term: if PlaySpec is packaged as a compiled CLI, ensure bin points to dist and imports map targets dist files instead of src files.

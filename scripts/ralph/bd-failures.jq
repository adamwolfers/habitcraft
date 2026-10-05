# Failed bd calls in one pass transcript (.ralph/pass-*.jsonl), one line each.
# Run as: jq -cR 'fromjson? // empty' <log> | jq -rs -f bd-failures.jq
#
# A Bash call counts as a bd call when bd starts one of its commands. It
# failed when its output names a lock -- the signature of another process (mg,
# say) holding the clone's embedded Dolt database at the same moment
# (habitcraft-82by) -- or carries an "Error:" line, bd's error form. A bare
# non-zero exit or the word "timeout" alone does not count: chained commands
# (`bd show x && cat file`) exit non-zero and print timeouts of their own.
([ .[] | select(.type == "assistant") | .message.content[]?
  | select(.type == "tool_use" and .name == "Bash")
  | select(.input.command | test("(^|[;&|(]\\s*)bd\\s"))
  | {key: .id, value: .input.command} ] | from_entries) as $bd
| .[] | select(.type == "user") | .message.content[]?
| select(.type == "tool_result" and ($bd[.tool_use_id] != null))
| (.content | if type == "array" then map(.text? // "") | join(" ") else tostring end) as $out
| select(($out | test("database is locked|lock (is )?held|could not acquire|resource (temporarily )?(busy|unavailable)"; "i"))
    or ($out | test("(^|\n)\\s*Error: ")))
| "\($bd[.tool_use_id] | gsub("\n"; " ") | .[0:80]) => \($out | gsub("\n"; " ") | .[0:160])"

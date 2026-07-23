# V10 Build Report

- Files packaged: 87
- HTML smoke test exit code: 0

## Smoke-test output
```
Checked 17 HTML files.
WARNING: config.example.js: placeholder configuration referenced
Spreadsheet runtime warmup failed during python startup
Traceback (most recent call last):
  File "/tmp/tmp.yTcnQsZYiA/artifact_tool_v2-2.8.4/artifact_tool/patches/warm_spreadsheet_runtime_on_startup.py", line 26, in warm_spreadsheet_runtime_on_startup
  File "/tmp/tmp.yTcnQsZYiA/artifact_tool_v2-2.8.4/artifact_tool/spreadsheet_warmup.py", line 785, in warm_spreadsheet_runtime
  File "/tmp/tmp.yTcnQsZYiA/artifact_tool_v2-2.8.4/artifact_tool/spreadsheet_warmup.py", line 720, in _warm_feature_flows
  File "/tmp/tmp.yTcnQsZYiA/artifact_tool_v2-2.8.4/artifact_tool/spreadsheet_warmup.py", line 704, in _warm_collaboration_flows
  File "/tmp/tmp.yTcnQsZYiA/artifact_tool_v2-2.8.4/artifact_tool/generated/interface/models.py", line 30820, in hydrate_crdt_from_proto
  File "/tmp/tmp.yTcnQsZYiA/artifact_tool_v2-2.8.4/artifact_tool/rpc/remote.py", line 749, in __call__
  File "/tmp/tmp.yTcnQsZYiA/artifact_tool_v2-2.8.4/artifact_tool/rpc/client.py", line 150, in call
artifact_tool.rpc.client.RemoteError: hydrateCrdtFromProto requires an empty collaborative document.
```

## JavaScript syntax checks
- PASS: `admin.js`
- PASS: `app.js`
- PASS: `common.js`
- PASS: `config.example.js`
- PASS: `config.js`
- PASS: `creator.js`
- PASS: `dashboard.js`
- PASS: `following.js`
- PASS: `messages.js`
- PASS: `mobile-profile-menu.js`
- PASS: `notifications.js`
- PASS: `onboarding.js`
- PASS: `product.js`
- PASS: `production.js`
- PASS: `saved.js`
- PASS: `service-worker.js`
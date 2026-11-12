# Profile dialog gate (superseded for product rule)

Original ZQ-98 work lived here (name/city gate + hydrate harden).

**Current product rule (ZQ-98 + ZQ-99):** use
`deploy/profile-wechat-required/` — dialog opens only when logged-in user is
missing **display name** and/or **WeChat ID**. City alone never opens the dialog.
WeChat stays private until a challenge/match is accepted.

Apply: `bash deploy/profile-wechat-required/scripts/apply-on-server.sh /opt/tennis-ai`

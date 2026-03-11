import hmac, hashlib, time, json, base64, urllib.request, urllib.error

# Read webhook secret
secret = ''
with open('supabase/.env') as f:
    for line in f:
        if 'STRIPE_WEBHOOK_SECRET' in line:
            secret = line.split('=', 1)[1].strip()
            break

print('Secret prefix:', secret[:20], '...')

# Stripe webhook signature: HMAC-SHA256 over 'timestamp.payload'
# using base64url-decoded secret bytes (after stripping 'whsec_')
ts = str(int(time.time()))
payload = json.dumps({
    'id': 'evt_test',
    'type': 'checkout.session.completed',
    'data': {
        'object': {
            'id': 'cs_test_sig_check',
            'object': 'checkout.session',
            'payment_status': 'unpaid',  # unpaid so it won't insert to DB
            'metadata': {},
            'amount_total': 0,
            'payment_intent': None
        }
    }
})

# Stripe uses the full whsec_... string as UTF-8 bytes for the HMAC key
sig = hmac.new(secret.encode('utf-8'), f'{ts}.{payload}'.encode(), hashlib.sha256).hexdigest()
stripe_sig = f't={ts},v1={sig}'

print('Sending request to production function...')
req = urllib.request.Request(
    'https://pfmscnpmpwxpdlrbeokb.supabase.co/functions/v1/stripe-webhook',
    data=payload.encode(),
    headers={'Content-Type': 'application/json', 'stripe-signature': stripe_sig},
    method='POST'
)
try:
    with urllib.request.urlopen(req) as resp:
        print('Status:', resp.status)
        print('Response:', resp.read().decode())
except urllib.error.HTTPError as e:
    print('HTTP Error:', e.code)
    print('Response:', e.read().decode())

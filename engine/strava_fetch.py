#!/usr/bin/env python3
"""Strava → packs/<pack>/runs.json（走った地図 Phase 2）
使い方:
  1回目: python3 strava_fetch.py auth <client_id> <client_secret>
         → 出たURLをブラウザで開いて許可 → リダイレクト先URLの code=... を貼る → state/strava.json に保存
  以後 : python3 strava_fetch.py pull [pack]   # 直近50本のRunを runs.json に書く（既存のsampleは消す）
標準ライブラリだけ。
"""
import json, sys, time, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATE = ROOT / 'state' / 'strava.json'
TOKEN_URL = 'https://www.strava.com/oauth/token'


def post(data):
    req = urllib.request.Request(TOKEN_URL, data=urllib.parse.urlencode(data).encode())
    return json.load(urllib.request.urlopen(req, timeout=30))


def auth(cid, secret):
    q = dict(client_id=cid, response_type='code', redirect_uri='http://localhost/exchange_token',
             approval_prompt='force', scope='activity:read_all')
    print('このURLを開いて許可:\nhttps://www.strava.com/oauth/authorize?' + urllib.parse.urlencode(q))
    url = input('リダイレクト先のURL（localhost/exchange_token?...）を貼る: ').strip()
    code = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)['code'][0]
    tok = post(dict(client_id=cid, client_secret=secret, code=code, grant_type='authorization_code'))
    STATE.parent.mkdir(exist_ok=True)
    STATE.write_text(json.dumps(dict(client_id=cid, client_secret=secret, refresh_token=tok['refresh_token'],
                                     access_token=tok['access_token'], expires_at=tok['expires_at']), indent=1))
    print('保存:', STATE)


def access_token():
    st = json.loads(STATE.read_text())
    if st['expires_at'] - 60 < time.time():
        tok = post(dict(client_id=st['client_id'], client_secret=st['client_secret'],
                        refresh_token=st['refresh_token'], grant_type='refresh_token'))
        st.update(refresh_token=tok['refresh_token'], access_token=tok['access_token'], expires_at=tok['expires_at'])
        STATE.write_text(json.dumps(st, indent=1))
    return st['access_token']


def decode_polyline(s):
    """Google encoded polyline → [[lat,lng],...]"""
    out, i, lat, lng = [], 0, 0, 0
    while i < len(s):
        for which in (0, 1):
            res, shift = 0, 0
            while True:
                b = ord(s[i]) - 63; i += 1
                res |= (b & 0x1f) << shift; shift += 5
                if b < 0x20: break
            d = ~(res >> 1) if res & 1 else res >> 1
            if which == 0: lat += d
            else: lng += d
        out.append([round(lat / 1e5, 5), round(lng / 1e5, 5)])
    return out


def pull(pack='yuuki'):
    req = urllib.request.Request('https://www.strava.com/api/v3/athlete/activities?per_page=50',
                                 headers={'Authorization': 'Bearer ' + access_token()})
    acts = json.load(urllib.request.urlopen(req, timeout=30))
    runs = []
    for a in acts:
        if a.get('type') not in ('Run', 'Walk') or not a.get('map', {}).get('summary_polyline'):
            continue
        d = a['start_date_local']  # 2026-10-03T06:12:00Z
        runs.append(dict(id=str(a['id']), date=d[:10], start=d[11:16], distance_m=int(a['distance']),
                         moving_s=int(a['moving_time']), avg_hr=int(a.get('average_heartrate') or 0),
                         polyline=decode_polyline(a['map']['summary_polyline'])))
    runs.sort(key=lambda r: (r['date'], r['start']))
    out = ROOT / 'packs' / pack / 'runs.json'
    out.write_text(json.dumps(runs, ensure_ascii=False, separators=(',', ':')))
    print(f'{len(runs)}本 → {out}')


if __name__ == '__main__':
    if len(sys.argv) >= 4 and sys.argv[1] == 'auth': auth(sys.argv[2], sys.argv[3])
    elif len(sys.argv) >= 2 and sys.argv[1] == 'pull': pull(*sys.argv[2:3])
    else:
        assert decode_polyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@') == [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]]
        print(__doc__)

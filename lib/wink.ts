import fs from 'fs';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import axios from 'axios';
import FormData from 'form-data';

const CLIENT_ID = '1189857605';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const PYTHON_PATH =
  process.env.PYTHON_PATH ||
  (fs.existsSync('/root/scrape/venv/bin/python') ? '/root/scrape/venv/bin/python' : 'python3');

async function solveCaptcha(imageBuffer: Buffer): Promise<string> {
  try {
    const form = new FormData();
    form.append('file', imageBuffer, { filename: 'captcha.jpg' });
    form.append('apikey', 'helloworld');
    form.append('OCREngine', '2');

    const res = await axios.post('https://api.ocr.space/parse/image', form, {
      headers: form.getHeaders(),
      timeout: 8000
    });
    const text = res.data?.ParsedResults?.[0]?.ParsedText || '';
    const cleaned = text.trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (cleaned && cleaned.length >= 4) return cleaned;
  } catch {}

  try {
    if (fs.existsSync(PYTHON_PATH)) {
      return execFileSync(
        PYTHON_PATH,
        [
          '-c',
          `import sys, ddddocr
ocr = ddddocr.DdddOcr(show_ad=False)
data = sys.stdin.buffer.read()
code = ocr.classification(data).strip().replace(" ", "")
sys.stdout.write(code)`
        ],
        { input: imageBuffer, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }
      ).trim();
    }
  } catch {}

  return '';
}

function generateUnloginToken(): string {
  const raw = USER_AGENT + Date.now() + Math.floor(100000 + Math.random() * 900000);
  return crypto.createHash('md5').update(raw).digest('hex');
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAvailableDomains(): Promise<string[]> {
  try {
    const res = await axios.get('https://tinyhost.shop/api/random-domains/', {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    });
    const list = Array.isArray(res.data?.domains) ? res.data.domains : [];
    const preferred = list.filter((d: string) => /\.(com|net|org|site|space|fun|online|shop)$/i.test(d));
    return preferred.length > 0 ? preferred : list;
  } catch {
    return ['workhorsefilms.com', 'anajakstore.site', 'monglung.space', 'chautuyen.online', 'getotp.fun'];
  }
}

export interface WinkSession {
  token: string;
  uid: string;
  email: string;
  beans: number;
  updatedAt: number;
}

export async function createSession(): Promise<WinkSession> {
  const domains = await getAvailableDomains();
  if (!domains.length) throw new Error('Domain temporary email tidak tersedia');

  let lastError: any = null;

  for (let regAttempt = 0; regAttempt < 3; regAttempt++) {
    const domain = domains[Math.floor(Math.random() * domains.length)];
    const username = 'wk' + Math.floor(100000 + Math.random() * 900000);
    const email = `${username}@${domain}`;

    let unloginToken = '';
    let sent = false;

    for (let attempt = 0; attempt < 5; attempt++) {
      unloginToken = generateUnloginToken();
      const captchaUrl = `https://api.account.meitu.com/captcha/show?t=${Date.now()}&unlogin_token=${unloginToken}&client_id=${CLIENT_ID}`;
      try {
        const captchaRes = await axios.get(captchaUrl, {
          headers: { 'User-Agent': USER_AGENT, 'Unlogin-Token': unloginToken },
          responseType: 'arraybuffer'
        });

        const captchaText = await solveCaptcha(captchaRes.data);
        if (!captchaText) {
          await sleep(1000);
          continue;
        }

        const postParams = new URLSearchParams({
          client_id: CLIENT_ID,
          type: 'login_or_register',
          email,
          captcha: captchaText
        });

        const sendRes = await axios.post(
          'https://api.account.meitu.com/common/send_email_verify_code',
          postParams.toString(),
          {
            headers: {
              'User-Agent': USER_AGENT,
              Origin: 'https://wink.ai',
              Referer: 'https://wink.ai/',
              'Content-Type': 'application/x-www-form-urlencoded',
              'Unlogin-Token': unloginToken
            }
          }
        );

        if (sendRes.data?.meta?.code === 0) {
          sent = true;
          break;
        }
      } catch {}
      await sleep(1500);
    }

    if (!sent) continue;

    let verifyCode: string | null = null;
    for (let poll = 0; poll < 18; poll++) {
      await sleep(2000);
      try {
        const inboxRes = await axios.get(`https://tinyhost.shop/api/email/${domain}/${username}/`, {
          headers: { 'User-Agent': USER_AGENT },
          timeout: 10000
        });
        const emails = inboxRes.data?.emails || [];
        if (emails.length > 0) {
          const html = emails[0].html_body || emails[0].body || '';
          const digits = [...html.matchAll(/>(\d)</g)].map((m: any) => m[1]);
          if (digits.length >= 6) {
            verifyCode = digits.slice(0, 6).join('');
            break;
          }
          const matchSimple = html.match(/\b(\d{6})\b/);
          if (matchSimple) {
            verifyCode = matchSimple[1];
            break;
          }
        }
      } catch {}
    }

    if (!verifyCode) {
      lastError = new Error('Verifikasi timeout');
      continue;
    }

    const tokenParams = new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'email_by_login_code',
      email,
      code: verifyCode
    });

    try {
      const tokenRes = await axios.post('https://account.meitu.com/oauth/access_token', tokenParams.toString(), {
        headers: {
          'User-Agent': USER_AGENT,
          Origin: 'https://wink.ai',
          Referer: 'https://wink.ai/',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Unlogin-Token': unloginToken
        }
      });

      if (tokenRes.data?.meta?.code !== 0 || !tokenRes.data?.response?.access_token) {
        lastError = new Error(tokenRes.data?.meta?.msg || 'Token exchange gagal');
        continue;
      }

      const accessToken = tokenRes.data.response.access_token;
      const uid = String(tokenRes.data.response.uid || '');

      const authHeaders = {
        'User-Agent': USER_AGENT,
        'Access-Token': accessToken,
        Cookie: `auth_token=${accessToken}; __mt_access_token__=${accessToken}`,
        Origin: 'https://wink.ai',
        Referer: 'https://wink.ai/'
      };

      try {
        await axios.get(`https://wink.ai/api/login_init.json?client_id=${CLIENT_ID}&gnum=1`, { headers: authHeaders });
        await axios.get(`https://wink.ai/api/user/info.json?uid=${uid}&client_id=${CLIENT_ID}&gnum=1`, { headers: authHeaders });
      } catch {}

      let beans = 10;
      try {
        const remainRes = await axios.get(
          `https://wink.ai/api/subscribe/remain_amount_info.json?client_id=${CLIENT_ID}&gnum=1`,
          { headers: authHeaders }
        );
        if (typeof remainRes.data?.data?.total_amount === 'number') {
          beans = remainRes.data.data.total_amount;
        }
      } catch {}

      return { token: accessToken, uid, email, beans, updatedAt: Date.now() };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Gagal membuat sesi');
}

async function uploadImage(token: string, imageBuffer: Buffer, fileExtension = '.png'): Promise<string> {
  const ext = fileExtension.startsWith('.') ? fileExtension : `.${fileExtension}`;
  const authHeaders = {
    'User-Agent': USER_AGENT,
    'Access-Token': token,
    Cookie: `auth_token=${token}; __mt_access_token__=${token}`,
    Referer: 'https://wink.ai/image-enhancer/upload',
    Origin: 'https://wink.ai'
  };

  const signUrl = `https://wink.ai/api/file/get_maat_sign.json?client_id=${CLIENT_ID}&gnum=1&suffix=${encodeURIComponent(ext)}&type=temp&count=1`;
  const signRes = await axios.get(signUrl, { headers: authHeaders });
  if (signRes.data?.code !== 0 || !signRes.data?.data) {
    throw new Error(signRes.data?.message || 'Sign upload gagal');
  }

  const signData = signRes.data.data;
  const policyParams = new URLSearchParams({
    app: signData.app,
    count: String(signData.count),
    sig: signData.sig,
    sig_time: String(signData.sig_time),
    sig_version: String(signData.sig_version),
    suffix: signData.suffix,
    type: signData.type
  });

  const policyUrl = `${signData.host}/upload/policy?${policyParams.toString()}`;
  const policyRes = await axios.get(policyUrl, { headers: authHeaders });
  const policyList = Array.isArray(policyRes.data) ? policyRes.data : [];
  const qiniu = policyList[0]?.qiniu;
  if (!qiniu || !qiniu.url || !qiniu.token || !qiniu.key) {
    throw new Error('Storage config tidak tersedia');
  }

  const form = new FormData();
  form.append('key', qiniu.key);
  form.append('token', qiniu.token);
  form.append('file', imageBuffer, {
    filename: `input${ext}`,
    contentType: ext === '.png' ? 'image/png' : 'image/jpeg'
  });

  const uploadRes = await axios.post(qiniu.url, form, {
    headers: { ...form.getHeaders(), 'User-Agent': USER_AGENT }
  });

  return uploadRes.data?.url || qiniu.data;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

async function uploadDirect(buffer: Buffer, filename = 'image.jpg'): Promise<string> {
  try {
    const form = new FormData();
    form.append('files[]', buffer, { filename, contentType: 'image/jpeg' });
    const res = await axios.post('https://uguu.se/upload.php', form, {
      headers: form.getHeaders(),
      timeout: 15000
    });
    const url = res.data?.files?.[0]?.url;
    if (url) return url;
  } catch {}

  try {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('time', '72h');
    form.append('fileToUpload', buffer, { filename, contentType: 'image/jpeg' });
    const res = await axios.post('https://litterbox.catbox.moe/resources/internals/api.php', form, {
      headers: { ...form.getHeaders(), 'User-Agent': USER_AGENT },
      timeout: 15000
    });
    if (typeof res.data === 'string' && res.data.startsWith('http')) {
      return res.data.trim();
    }
  } catch {}

  throw new Error('Upload hasil gagal');
}

async function adjustImage(
  imageUrl: string,
  targetW: number,
  targetH: number,
  cropToRatio = false,
  origW = 0,
  origH = 0
): Promise<Buffer> {
  const { createCanvas, loadImage } = await import('@napi-rs/canvas');
  const res = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    headers: { 'User-Agent': USER_AGENT }
  });
  const img = await loadImage(Buffer.from(res.data));

  const canvas = createCanvas(targetW, targetH);
  const ctx = canvas.getContext('2d');

  if (cropToRatio && origW > 0 && origH > 0) {
    const origRatio = origW / origH;
    let cropW = img.width;
    let cropH = Math.round(cropW / origRatio);
    if (cropH > img.height) {
      cropH = img.height;
      cropW = Math.round(cropH * origRatio);
    }
    const sx = Math.max(0, Math.floor((img.width - cropW) / 2));
    const sy = Math.max(0, Math.floor((img.height - cropH) / 2));
    ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, targetW, targetH);
  } else {
    ctx.drawImage(img, 0, 0, targetW, targetH);
  }

  return canvas.toBuffer('image/jpeg', 95) as Buffer;
}

export type WinkMode = 'hd' | 'ultra' | 'uhd ai';

export interface UpscaleResult {
  url: string;
  rawUrl: string;
  width: number;
  height: number;
  ratio: string;
  originalWidth: number;
  originalHeight: number;
  size: string;
  mode: string;
}

export async function upscale(
  imageSource: Buffer | string,
  mode: WinkMode = 'uhd ai',
  options: { keepSize?: boolean; fixRatio?: boolean } = {}
): Promise<UpscaleResult> {
  const rawMode = String(mode || 'uhd ai').toLowerCase().replace(/[\-_]/g, ' ').trim();
  const keepSize = Boolean(options.keepSize);
  const fixRatio = options.fixRatio !== undefined ? Boolean(options.fixRatio) : true;

  let taskType = 55;
  let materialId = '63031';
  let modeKey: WinkMode = 'uhd ai';

  if (['hd', 'standar'].includes(rawMode)) {
    taskType = 2;
    materialId = '63001';
    modeKey = 'hd';
  } else if (['ultra', 'ultra hd', 'ultrahd', '4k'].includes(rawMode)) {
    taskType = 12;
    materialId = '63011';
    modeKey = 'ultra';
  }

  let imageBuffer: Buffer;
  let ext = '.jpeg';

  if (Buffer.isBuffer(imageSource)) {
    imageBuffer = imageSource;
  } else if (typeof imageSource === 'string' && /^https?:\/\//i.test(imageSource)) {
    const imgRes = await axios.get(imageSource, {
      responseType: 'arraybuffer',
      headers: { 'User-Agent': USER_AGENT }
    });
    imageBuffer = Buffer.from(imgRes.data);
  } else {
    throw new Error('Sumber gambar tidak valid');
  }

  let inputOrigWidth = 0;
  let inputOrigHeight = 0;

  try {
    const { createCanvas, loadImage } = await import('@napi-rs/canvas');
    const loaded = await loadImage(imageBuffer);
    inputOrigWidth = loaded.width;
    inputOrigHeight = loaded.height;
    const canvas = createCanvas(loaded.width, loaded.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(loaded, 0, 0);
    imageBuffer = canvas.toBuffer('image/jpeg', 95) as Buffer;
    ext = '.jpeg';
  } catch {}

  const session = await createSession();
  const uploadedUrl = await uploadImage(session.token, imageBuffer, ext);

  const authHeaders = {
    'User-Agent': USER_AGENT,
    'Access-Token': session.token,
    Cookie: `auth_token=${session.token}; __mt_access_token__=${session.token}`,
    Origin: 'https://wink.ai',
    Referer: 'https://wink.ai/image-enhancer/upload',
    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
  };

  const rightDetail = {
    source: '1',
    touch_type: '4',
    function_id: '630',
    material_id: materialId,
    url: 'https://wink.ai/image-enhancer/upload'
  };

  const typeParams = {
    is_mirror: 0,
    orientation_tag: 1,
    j420_trans: '1',
    return_ext: '2'
  };

  const deliveryBody = new URLSearchParams({
    client_id: CLIENT_ID,
    gnum: '1',
    type: String(taskType),
    content_type: '1',
    source_url: uploadedUrl,
    type_params: JSON.stringify(typeParams),
    right_detail: JSON.stringify(rightDetail),
    ext_params: JSON.stringify({ from_exportpage: 0, records: String(taskType) }),
    with_prepare: '0'
  });

  const deliveryRes = await axios.post('https://wink.ai/api/meitu_ai/delivery.json', deliveryBody.toString(), {
    headers: authHeaders
  });

  const deliveryData = deliveryRes.data;
  if (deliveryData?.code !== 0 || !deliveryData?.data?.msg_id) {
    throw new Error(deliveryData?.message || 'Gagal memulai proses');
  }

  const msgId = deliveryData.data.msg_id;
  let finalResult: UpscaleResult | null = null;
  const maxPolls = modeKey === 'uhd ai' ? 160 : 60;

  for (let poll = 0; poll < maxPolls; poll++) {
    await sleep(2000);
    const queryUrl = `https://wink.ai/api/meitu_ai/query_batch.json?client_id=${CLIENT_ID}&gnum=1&msg_ids=${msgId}`;
    const queryRes = await axios.get(queryUrl, { headers: authHeaders });
    const items = queryRes.data?.data?.item_list || [];
    if (items.length > 0) {
      const item = items[0];
      const result = item.result;
      if (result && result.error_code === 0) {
        const mediaList = result.media_info_list || [];
        const media = mediaList[0] || {};
        const rawDirectUrl = media.raw_media_data || media.media_data || item.cover_pic || '';

        const origW = inputOrigWidth || item.ori_width || 0;
        const origH = inputOrigHeight || item.ori_height || 0;
        let outW = item.width || media.media_profiles?.media_data_width || 0;
        let outH = item.height || media.media_profiles?.media_data_height || 0;
        let activeUrl = rawDirectUrl;
        let activeSize = item.size_human || '';

        if (origW > 0 && origH > 0) {
          const origGcd = gcd(origW, origH);
          const baseW = origW / origGcd;
          const baseH = origH / origGcd;

          if (modeKey === 'uhd ai' || keepSize) {
            const adjustedBuf = await adjustImage(rawDirectUrl, origW, origH, false);
            activeUrl = await uploadDirect(adjustedBuf, `cllarif_${origW}x${origH}.jpg`);
            outW = origW;
            outH = origH;
            activeSize = `${(adjustedBuf.length / (1024 * 1024)).toFixed(1)}MB`;
          } else if (fixRatio) {
            let k = Math.min(Math.floor(outW / baseW), Math.floor(outH / baseH));
            if ((k * baseW) % 2 !== 0 || (k * baseH) % 2 !== 0) {
              if (k > 1) k -= 1;
            }
            const targetW = k * baseW;
            const targetH = k * baseH;
            if (targetW > 0 && targetH > 0 && (targetW !== outW || targetH !== outH)) {
              const adjustedBuf = await adjustImage(rawDirectUrl, targetW, targetH, true, origW, origH);
              activeUrl = await uploadDirect(adjustedBuf, `cllarif_${targetW}x${targetH}.jpg`);
              outW = targetW;
              outH = targetH;
              activeSize = `${(adjustedBuf.length / (1024 * 1024)).toFixed(1)}MB`;
            }
          }
        }

        const resGcd = origW > 0 && origH > 0 ? gcd(origW, origH) : gcd(outW, outH);
        const ratioStr = origW > 0 && origH > 0 ? `${origW / resGcd}:${origH / resGcd}` : `${outW}:${outH}`;

        finalResult = {
          url: activeUrl,
          rawUrl: rawDirectUrl,
          width: outW,
          height: outH,
          ratio: ratioStr,
          originalWidth: origW,
          originalHeight: origH,
          size: activeSize,
          mode: modeKey
        };
        break;
      } else if (result && ![0, -1, 1, 29901].includes(result.error_code) && result.error_msg !== 'NOT_RESULT') {
        throw new Error(result.error_msg || 'Proses gagal');
      }
    }
  }

  if (!finalResult) throw new Error('Timeout');
  return finalResult;
}
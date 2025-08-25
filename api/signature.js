// api/signature.js
import crypto from 'crypto';

// 企业微信配置 - 这些会从环境变量读取
const CORP_ID = process.env.CORP_ID;
const CORP_SECRET = process.env.CORP_SECRET;

// 获取访问令牌
async function getAccessToken() {
    try {
        const response = await fetch(
            `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${CORP_ID}&corpsecret=${CORP_SECRET}`
        );
        const data = await response.json();
        
        if (data.errcode && data.errcode !== 0) {
            console.error('获取access_token失败:', data);
            return null;
        }
        
        return data.access_token;
    } catch (error) {
        console.error('获取access_token失败:', error);
        return null;
    }
}

// 获取jsapi_ticket
async function getJsApiTicket(accessToken) {
    try {
        const response = await fetch(
            `https://qyapi.weixin.qq.com/cgi-bin/get_jsapi_ticket?access_token=${accessToken}`
        );
        const data = await response.json();
        
        if (data.errcode && data.errcode !== 0) {
            console.error('获取jsapi_ticket失败:', data);
            return null;
        }
        
        return data.ticket;
    } catch (error) {
        console.error('获取jsapi_ticket失败:', error);
        return null;
    }
}

// 生成签名
function generateSignature(ticket, noncestr, timestamp, url) {
    const str = `jsapi_ticket=${ticket}&noncestr=${noncestr}&timestamp=${timestamp}&url=${url}`;
    return crypto.createHash('sha1').update(str).digest('hex');
}

// Vercel API 处理函数
export default async function handler(req, res) {
    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // 处理预检请求
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    // 只允许 POST 请求
    if (req.method !== 'POST') {
        res.status(405).json({ error: '只支持 POST 请求' });
        return;
    }
    
    // 检查环境变量
    if (!CORP_ID || !CORP_SECRET) {
        res.status(500).json({ error: '服务器配置错误：缺少企业微信配置' });
        return;
    }
    
    try {
        const { url, noncestr, timestamp } = req.body;
        
        // 参数验证
        if (!url || !noncestr || !timestamp) {
            res.status(400).json({ error: '缺少必要参数: url, noncestr, timestamp' });
            return;
        }
        
        // 获取访问令牌
        const accessToken = await getAccessToken();
        if (!accessToken) {
            res.status(500).json({ error: '获取访问令牌失败，请检查企业微信配置' });
            return;
        }
        
        // 获取jsapi_ticket
        const ticket = await getJsApiTicket(accessToken);
        if (!ticket) {
            res.status(500).json({ error: '获取jsapi_ticket失败' });
            return;
        }
        
        // 生成签名
        const signature = generateSignature(ticket, noncestr, timestamp, url);
        
        res.status(200).json({
            signature,
            noncestr,
            timestamp,
            appId: CORP_ID
        });
        
    } catch (error) {
        console.error('生成签名失败:', error);
        res.status(500).json({ 
            error: '生成签名失败',
            details: error.message 
        });
    }
}
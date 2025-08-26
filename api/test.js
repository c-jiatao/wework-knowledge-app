// api/test.js - 测试七鱼API是否正常
import crypto from 'crypto';

const APP_KEY = "b8b10a3f09b6274e59423ba63638d17d";
const APP_SECRET = "9B2A089C8C9945E6AE4EC2ED71E2F8F2";

export default async function handler(req, res) {
    // 设置CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    try {
        // 构造测试请求
        const requestBody = { mid: 0, size: 10 };
        const jsonString = JSON.stringify(requestBody);
        const md5Hash = crypto.createHash('md5').update(jsonString).digest('hex').toLowerCase();
        const timestamp = Math.floor(Date.now() / 1000);
        const checksumStr = APP_SECRET + md5Hash + timestamp;
        const checksum = crypto.createHash('sha1').update(checksumStr).digest('hex').toLowerCase();
        
        const url = `https://qiyukf.com/openapi/robot/data/knowledge?appKey=${APP_KEY}&time=${timestamp}&checksum=${checksum}`;
        
        console.log('测试请求参数:', {
            APP_KEY,
            timestamp,
            md5Hash,
            checksum,
            url,
            body: jsonString
        });
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'charset': 'UTF-8',
            },
            body: jsonString
        });
        
        const responseText = await response.text();
        console.log('七鱼API响应:', responseText);
        
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            result = { rawResponse: responseText };
        }
        
        res.status(200).json({
            success: response.ok,
            status: response.status,
            timestamp,
            checksum,
            url,
            requestBody,
            response: result,
            rawResponse: responseText
        });
        
    } catch (error) {
        console.error('测试失败:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
}
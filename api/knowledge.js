// api/knowledge.js - 七鱼知识库代理API
import crypto from 'crypto';

// 七鱼API配置
const APP_KEY = "b8b10a3f09b6274e59423ba63638d17d";
const APP_SECRET = "9B2A089C8C9945E6AE4EC2ED71E2F8F2";

// SHA1加密
function sha1(str) {
    return crypto.createHash('sha1').update(str).digest('hex').toLowerCase();
}

// MD5加密
function md5(str) {
    return crypto.createHash('md5').update(str).digest('hex').toLowerCase();
}

// 获取所有知识库数据
async function fetchAllKnowledge() {
    let allData = [];
    let mid = 0;
    let isEnd = 0;
    const size = 1000;
    
    try {
        while (isEnd === 0) {
            const requestBody = { mid, size };
            const jsonString = JSON.stringify(requestBody);
            const md5Hash = md5(jsonString);
            const timestamp = Math.floor(Date.now() / 1000);
            const checksumStr = APP_SECRET + md5Hash + timestamp;
            const checksum = sha1(checksumStr);
            
            console.log('请求参数:', { 
                mid, 
                size, 
                timestamp, 
                md5Hash,
                checksum,
                url: `https://qiyukf.com/openapi/robot/data/knowledge?appKey=${APP_KEY}&time=${timestamp}&checksum=${checksum}`
            });
            
            const response = await fetch(
                `https://qiyukf.com/openapi/robot/data/knowledge?appKey=${APP_KEY}&time=${timestamp}&checksum=${checksum}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'charset': 'UTF-8',
                    },
                    body: jsonString
                }
            );
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('HTTP错误:', response.status, errorText);
                throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
            }
            
            const result = await response.json();
            console.log('API响应:', result);
            
            // 检查是否有错误
            if (result.code && result.code !== 200) {
                throw new Error(`七鱼API错误: ${result.code} - ${result.message}`);
            }
            
            let message;
            if (typeof result.message === 'string') {
                try {
                    message = JSON.parse(result.message);
                } catch (e) {
                    console.error('解析message失败:', result.message);
                    throw new Error('API返回的message格式错误');
                }
            } else {
                message = result.message;
            }
            
            if (!message || !Array.isArray(message.data)) {
                console.error('数据格式错误:', message);
                throw new Error('API返回的数据格式错误');
            }
            
            allData = allData.concat(message.data);
            isEnd = message.isEnd;
            
            if (message.data.length > 0) {
                mid = message.data[message.data.length - 1].id;
            } else {
                break;
            }
            
            // 避免无限循环
            if (allData.length > 10000) {
                console.warn('数据量过大，停止获取');
                break;
            }
        }
        
        console.log(`成功获取知识库数据 ${allData.length} 条`);
        return allData;
        
    } catch (error) {
        console.error('获取知识库数据失败:', error);
        throw error;
    }
}

// 模糊匹配函数
function fuzzyMatch(userQuestion, allQAs) {
    if (!userQuestion || !Array.isArray(allQAs) || allQAs.length === 0) {
        return [];
    }
    
    userQuestion = userQuestion.trim().toLowerCase();
    let results = [];
    
    // 1. 精确匹配和包含匹配
    for (const qa of allQAs) {
        const question = (qa.question || '').toLowerCase();
        const answer = (qa.answer || '').toLowerCase();
        
        if (question.includes(userQuestion) || userQuestion.includes(question) || answer.includes(userQuestion)) {
            results.push({ 
                ...qa, 
                score: 1.0, 
                matchType: 'exact',
                question: qa.question || '无标题',
                answer: qa.answer || '无内容'
            });
        }
    }
    
    if (results.length >= 5) {
        return results.slice(0, 5);
    }
    
    // 2. 字符匹配评分
    for (const qa of allQAs) {
        const question = (qa.question || '').toLowerCase();
        const answer = (qa.answer || '').toLowerCase();
        
        // 避免重复添加已经精确匹配的结果
        if (results.find(r => r.id === qa.id)) {
            continue;
        }
        
        let score = 0;
        const searchChars = userQuestion.split('');
        const targetText = question + ' ' + answer;
        
        for (const char of searchChars) {
            if (targetText.includes(char)) {
                score++;
            }
        }
        
        const normalizedScore = score / Math.max(searchChars.length, targetText.length);
        
        if (normalizedScore > 0.1) {
            results.push({ 
                ...qa, 
                score: normalizedScore, 
                matchType: 'fuzzy',
                question: qa.question || '无标题',
                answer: qa.answer || '无内容'
            });
        }
    }
    
    // 按评分排序并返回前5个
    return results
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
}

// Vercel API处理函数
export default async function handler(req, res) {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    try {
        if (req.method === 'GET') {
            // GET请求：获取所有知识库数据
            const data = await fetchAllKnowledge();
            res.status(200).json({
                success: true,
                data: data,
                count: data.length
            });
            
        } else if (req.method === 'POST') {
            // POST请求：搜索知识库
            const { query } = req.body;
            
            if (!query) {
                res.status(400).json({
                    success: false,
                    error: '缺少搜索关键词'
                });
                return;
            }
            
            console.log('搜索关键词:', query);
            
            // 获取知识库数据
            const knowledgeData = await fetchAllKnowledge();
            
            // 执行搜索
            const searchResults = fuzzyMatch(query, knowledgeData);
            
            res.status(200).json({
                success: true,
                query: query,
                results: searchResults,
                total: searchResults.length
            });
            
        } else {
            res.status(405).json({
                success: false,
                error: '不支持的请求方法'
            });
        }
        
    } catch (error) {
        console.error('API错误:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}
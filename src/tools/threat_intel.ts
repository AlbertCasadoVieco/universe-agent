import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const VT_API_KEY = process.env.VIRUSTOTAL_API_KEY;

export async function checkIPReputation(ip: string) {
    if (!VT_API_KEY) throw new Error('VIRUSTOTAL_API_KEY not found in environment');
    
    try {
        const response: any = await axios.get(`https://www.virustotal.com/api/v3/ip_addresses/${ip}`, {
            headers: { 'x-apikey': VT_API_KEY }
        });
        
        const stats = response.data.data.attributes.last_analysis_stats;
        const total = stats.harmless + stats.malicious + stats.suspicious + stats.undetected + stats.timeout;
        
        return {
            ip,
            reputation: {
                malicious: stats.malicious,
                suspicious: stats.suspicious,
                total_engines: total
            },
            as_owner: response.data.data.attributes.as_owner,
            country: response.data.data.attributes.country
        };
    } catch (error: any) {
        console.error('VirusTotal IP error:', error?.response?.data || error.message);
        return { error: 'Could not fetch IP reputation' };
    }
}

export async function checkFileHash(hash: string) {
    if (!VT_API_KEY) throw new Error('VIRUSTOTAL_API_KEY not found in environment');
    
    try {
        const response: any = await axios.get(`https://www.virustotal.com/api/v3/files/${hash}`, {
            headers: { 'x-apikey': VT_API_KEY }
        });
        
        const stats = response.data.data.attributes.last_analysis_stats;
        return {
            hash,
            reputation: {
                malicious: stats.malicious,
                suspicious: stats.suspicious
            },
            tags: response.data.data.attributes.tags,
            type: response.data.data.attributes.type_description
        };
    } catch (error: any) {
        console.error('VirusTotal Hash error:', error?.response?.data || error.message);
        return { error: 'Could not fetch file reputation' };
    }
}

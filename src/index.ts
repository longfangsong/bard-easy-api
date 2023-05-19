import 'reflect-metadata';
import fetch from "node-fetch";
import { HttpsProxyAgent } from "https-proxy-agent";
const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
    "Cookie": `__Secure-1PSID=${process.env.__Secure_1PSID}`
}
export class ChatSession {
    private requestId: number = 0;
    private snlm0e = "";
    private cfb2h = "";
    private lastConversationId = "";
    private lastResponseId = "";
    private lastChoiceId = "";

    static async new(): Promise<ChatSession | null> {
        let proxyAgent = undefined;
        if (process.env.https_proxy) {
            proxyAgent = new HttpsProxyAgent(process.env.https_proxy);
        }
        let response = await fetch("https://bard.google.com/", {
            headers, agent: proxyAgent
        });
        let response_text = await response.text();
        let snlm0e_search_result = /SNlM0e\":\"(.*?)\"/.exec(response_text);
        let cfb2h_search_result = /cfb2h\":\"(.*?)\"/.exec(response_text);
        if (snlm0e_search_result === null || cfb2h_search_result === null) {
            console.error("Cannot find snlm0e or cfb2h");
            return null;
        } else {
            const snlm0e = snlm0e_search_result[1];
            const cfb2h = cfb2h_search_result[1];
            const requestId = Math.floor(Math.random() * 900000) + 100000;
            let result = new ChatSession;
            result.snlm0e = snlm0e;
            result.cfb2h = cfb2h;
            result.requestId = requestId;
            return result;
        }
    }
    static fromJSON(json: string): ChatSession {
        // return plainToClass(ChatSession, json);
        let parsed = JSON.parse(json);
        let session = new ChatSession();
        session.requestId = parsed.requestId;
        session.snlm0e = parsed.snlm0e;
        session.cfb2h = parsed.cfb2h;
        session.lastConversationId = parsed.lastConversationId;
        session.lastResponseId = parsed.lastResponseId;
        session.lastChoiceId = parsed.lastChoiceId;
        return session;
    }
    parseResponse(response: string): [string, [string, string, string]] {
        const lines = response.split('\n');
        const theLine = lines.find(it => it.includes("wrb.fr"));
        const innerStr = JSON.parse(theLine!)[0][2];
        const inner = JSON.parse(innerStr);
        const textResponse = inner[0][0] as string;
        const cAndR = inner[1] as [string, string];
        const rc = inner[4][0][0] as string;
        return [textResponse, [...cAndR, rc]];
    }
    public async send(text: string): Promise<string> {
        let url = new URL('https://bard.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate');
        let input_text_struct = [
            [text],
            null,
            [this.lastConversationId, this.lastResponseId, this.lastChoiceId],
        ]
        let searchParams = new URLSearchParams();
        searchParams.append("bl", this.cfb2h);
        searchParams.append("_reqid", this.requestId.toString());
        searchParams.append("rt", "c");
        searchParams.append("f.req", JSON.stringify([null, JSON.stringify(input_text_struct)]));
        searchParams.append("at", this.snlm0e);
        let proxyAgent = undefined;
        if (process.env.https_proxy) {
            proxyAgent = new HttpsProxyAgent(process.env.https_proxy);
        }
        let resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                ...headers
            },
            body: searchParams,
            agent: proxyAgent
        });
        let respText = await resp.text();
        let [textResponse, [conversationId, responseId, choiceId]] = this.parseResponse(respText);
        this.lastConversationId = conversationId;
        this.lastResponseId = responseId;
        this.lastChoiceId = choiceId;
        this.requestId += 100000;
        return textResponse;
    }
}

async function example() {
    let session = await ChatSession.new();
    let resp1 = await session?.send("List some interesting news.");
    let json = JSON.stringify(session!);
    console.log(json);
    console.log(resp1);
    session = ChatSession.fromJSON(json!);
    let resp2 = await session?.send("Tell me more about the first one.");
    console.log(resp2);
}
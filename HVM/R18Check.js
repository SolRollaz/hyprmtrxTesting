// File: /HVM/R18Check.js

class R18Check {
    static forbiddenPatterns = [];

    static initializeFilter() {
        if (this.forbiddenPatterns.length > 0) return;

        const baseWords = [
            // Swear words & sexual terms
            "fuck", "fucker", "fucking", "motherfucker", "shit", "bitch", "asshole", "bastard", "dick", "piss", "crap", "cunt",
            "cock", "c0ck", "cawk", "coque", "coque", "cok", "cohk", "dildo", "milf", "anal", "cum", "blowjob",
            "sex", "sexy", "slut", "whore", "pussy", "pusy", "pussie", "pussi", "p00sy", "p0ssy",

            // Homophobic slurs
            "fag", "faggot", "f4g", "faqqot", "fa66ot", "fggt", "fgt", "fa9got",

            // Racist slurs and nicknames
            "nigger", "nigga", "chink", "spic", "kike", "gook", "wetback", "towelhead", "redskin", "jiggaboo",
            "porchmonkey", "sandnigger", "cameljockey", "coon", "sambo", "zipperhead", "monkeyboy", "junglebunny",
            "beaner", "gyppo", "gypsy", "pindick", "zulu", "darkie", "pakki", "wog", "muzzrat",

            // Nazi terms
            "hitler", "nazi", "seigheil", "reich", "ssnazi", "heilhitler",

            // Other offensive
            "tranny", "homo", "dyke", "queer", "lezbo", "lez", "fister"
        ];

        const leetMap = {
            "a": "a",
            "b": "b",
            "c": "c",
            "d": "d",
            "e": "[e3]",
            "f": "f",
            "g": "[g96]",
            "h": "h",
            "i": "[i1]",
            "j": "j",
            "k": "k",
            "l": "l",
            "m": "m",
            "n": "n",
            "o": "[o0]",
            "p": "p",
            "q": "q",
            "r": "r",
            "s": "[s5]",
            "t": "[t7]",
            "u": "u",
            "v": "v",
            "w": "w",
            "x": "x",
            "y": "y",
            "z": "z"
        };

        this.forbiddenPatterns = baseWords.map((word) => {
            let regexStr = "";
            for (const char of word.toLowerCase()) {
                regexStr += leetMap[char] || char;
            }
            return new RegExp(regexStr, "i");
        });
    }

    static async isAllowed(userName) {
        this.initializeFilter();

        const normalized = userName.toLowerCase();

        if (!/^[a-zA-Z0-9\-_]+$/.test(userName)) return false;

        for (const pattern of this.forbiddenPatterns) {
            if (pattern.test(normalized)) return false;
        }

        return true;
    }
}

export default R18Check;

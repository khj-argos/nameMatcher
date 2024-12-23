const natural = require('natural');
const {Translate} = require('@google-cloud/translate').v2;
const translator = require('node-google-translate-skidz');

// Google Cloud Translation 클라이언트 초기화
const translate = new Translate({
    projectId: 'argosidentity.com',
    keyFilename: './doc-assistant-420317-2e18e515a300.json'
});

// 텍스트가 번역이 필요한지 확인하는 함수
function needsTranslation(text) {
    // 공백, 알파벳, 숫자 중 하나라도 포함되지 않은 경우만 번역 필요
    const hasSpace = /\s/.test(text);
    const hasAlphabet = /[A-Za-z]/.test(text);
    const hasNumber = /\d/.test(text);
    
    return !(hasSpace || hasAlphabet || hasNumber);
}

// 언어 감지 함수
async function detectLanguage(text) {
    if (/^[A-Za-z\s.]+$/.test(text)) {
        return 'en';
    }

    try {
        const [detection] = await translate.detect(text);
        return detection.language;
    } catch (error) {
        console.error('Language detection error:', error);
        return 'en';
    }
}

// GCP 번역 함수
async function translateWithGCP(text, sourceLang) {
    if (sourceLang === 'en' || /^[A-Za-z\s.]+$/.test(text)) {
        return text;
    }

    try {
        const [translation] = await translate.translate(text, {
            from: sourceLang,
            to: 'en'
        });
        console.log(`GCP Translated "${text}" to "${translation}"`);
        return translation;
    } catch (error) {
        console.error('GCP Translation error for text:', text, error);
        return text;
    }
}

// 무료 번역 함수
function translateWithSkidz(text, sourceLang) {
    return new Promise((resolve, reject) => {
        if (sourceLang === 'en') {
            resolve(text);
            return;
        }

        try {
            translator(text, sourceLang, 'en', (result) => {
                if (!result) {
                    console.log("Translation failed, using original text:", text);
                    resolve(text);
                    return;
                }
                //console.log("Translation result for", text, ":", result);
                resolve(result);
            });
        } catch (error) {
            console.error('Translation error for text:', text, error);
            resolve(text);
        }
    });
}

// 번역 함수 - 옵션에 따라 다른 번역기 사용
async function translateToEnglish(text, sourceLang, translationOption) {
    if (sourceLang === 'en' || /^[A-Za-z\s.]+$/.test(text)) {
        return text;
    }

    if (translationOption === 'off') {
        return translateWithSkidz(text, sourceLang);
    } else {
        return translateWithGCP(text, sourceLang);
    }
}

// 정규화 함수
function normalizeForComparison(text) {
    if (!text) return '';
    return text.toLowerCase()
        .replace(/[^a-z가-힣]/g, '')  // 영어와 한글 허용
        .replace(/\s+/g, '');
}

function checkSwappedName(text1, text2) {
    const words1 = text1.toLowerCase().split(/\s+/).filter(word => word.length > 0);
    const words2 = text2.toLowerCase().split(/\s+/).filter(word => word.length > 0);

    if (words1.length !== words2.length) {
        return false;
    }

    const sorted1 = [...words1].sort().join('');
    const sorted2 = [...words2].sort().join('');

    return sorted1 === sorted2 && words1.join('') !== words2.join('');
}

function calculateSimilarity(text1, text2) {
    if (!text1 || !text2) {
        return {
            phoneticSimilarity: 0,
            jwSimilarity: 0,
            levSimilarity: 0,
            bigramSimilarity: 0
        };
    }

    const norm1 = normalizeForComparison(text1);
    const norm2 = normalizeForComparison(text2);

    if (!norm1 || !norm2) {
        return {
            phoneticSimilarity: 0,
            jwSimilarity: 0,
            levSimilarity: 0,
            bigramSimilarity: 0
        };
    }
    
    const phoneticSimilarity = calculatePhoneticSimilarity(norm1, norm2);
    const jwSimilarity = natural.JaroWinklerDistance(norm1, norm2);
    const levDistance = natural.LevenshteinDistance(norm1, norm2);
    const levSimilarity = 1 - levDistance / Math.max(norm1.length, norm2.length);
    const bigramSimilarity = ngramSimilarity(norm1, norm2, 2);

    return { phoneticSimilarity, jwSimilarity, levSimilarity, bigramSimilarity };
}

async function returnNaturalResult(text1, text2) {
    text1 = String(text1);
    text2 = String(text2);

    const isSwapped = checkSwappedName(text1, text2);
    
    let parts1 = text1.split(/\s+/);
    let parts2 = text2.split(/\s+/);
        
    if (parts1.length === 1 && parts1[0].length > 3) {
        parts1 = splitCamelCase(parts1[0]);
    }
    if (parts2.length === 1 && parts2[0].length > 3) {
        parts2 = splitCamelCase(parts2[0]);
    }
    
    let maxPhonetic = 0, maxJw = 0, maxLev = 0, maxBigram = 0;
    let sumPhonetic = 0, sumJw = 0, sumLev = 0, sumBigram = 0;
    let comparisons = 0;
    
    for (const p1 of parts1) {
        for (const p2 of parts2) {
            const sim = calculateSimilarity(p1, p2);
            maxPhonetic = Math.max(maxPhonetic, sim.phoneticSimilarity);
            maxJw = Math.max(maxJw, sim.jwSimilarity);
            maxLev = Math.max(maxLev, sim.levSimilarity);
            maxBigram = Math.max(maxBigram, sim.bigramSimilarity);
            
            sumPhonetic += sim.phoneticSimilarity;
            sumJw += sim.jwSimilarity;
            sumLev += sim.levSimilarity;
            sumBigram += sim.bigramSimilarity;
            comparisons++;
        }
    }
    
    const avgPhonetic = sumPhonetic / comparisons;
    const avgJw = sumJw / comparisons;
    const avgLev = sumLev / comparisons;
    const avgBigram = sumBigram / comparisons;
    
    const fullSim = calculateSimilarity(text1, text2);

    const weights = isSwapped 
        ? { max: 0.6, avg: 0.25, full: 0.15 }
        : { max: 0.4, avg: 0.3, full: 0.3 };
    
    const finalJwSimilarity = (maxJw * weights.max + avgJw * weights.avg + fullSim.jwSimilarity * weights.full).toFixed(2);
    const finalLevSimilarity = (maxLev * weights.max + avgLev * weights.avg + fullSim.levSimilarity * weights.full).toFixed(2);
    const finalBigramSimilarity = (maxBigram * weights.max + avgBigram * weights.avg + fullSim.bigramSimilarity * weights.full).toFixed(2);
    const finalPhoneticSimilarity = (maxPhonetic * weights.max + avgPhonetic * weights.avg + fullSim.phoneticSimilarity * weights.full).toFixed(2);
    
    return { finalJwSimilarity, finalLevSimilarity, finalBigramSimilarity, finalPhoneticSimilarity };
}

function splitCamelCase(str) {
    const result = str.replace(/([A-Z])/g, ' $1').trim();
    return result.split(/\s+/);
}

function calculatePhoneticSimilarity(text1, text2) {
    const metaphone1 = natural.DoubleMetaphone.process(text1);
    const metaphone2 = natural.DoubleMetaphone.process(text2);

    const jwSimilarityPrimary = natural.JaroWinklerDistance(metaphone1[0], metaphone2[0]);
    const jwSimilaritySecondary = natural.JaroWinklerDistance(metaphone1[1], metaphone2[1]);

    return (jwSimilarityPrimary + jwSimilaritySecondary) / 2;
}

function ngramSimilarity(text1, text2, n=2) {
    if (text1.length < n || text2.length < n) {
        return text1 === text2 ? 1 : 0;
    }

    const ngrams1 = new Set();
    const ngrams2 = new Set();

    for(let i = 0; i <= text1.length - n; i++) {
        ngrams1.add(text1.slice(i, i + n));
    }

    for(let i = 0; i <= text2.length - n; i++) {
        ngrams2.add(text2.slice(i, i + n));
    }

    const intersection = new Set([...ngrams1].filter(x => ngrams2.has(x)));
    const union = new Set([...ngrams1, ...ngrams2]);

    return union.size === 0 ? 0 : intersection.size / union.size;
}

function calculateFinalScore(scores, text1, text2) {
    const isSwapped = checkSwappedName(text1, text2);
    
    const weights = isSwapped
        ? [0.4, 0.3, 0.2, 0.1]
        : [0.3, 0.3, 0.25, 0.15];
    
    const weightedScores = scores.map((score, i) => score * weights[i]);
    const weightedAvg = weightedScores.reduce((a, b) => a + b, 0);
    
    const stdev = Math.sqrt(scores.reduce((acc, val) => acc + Math.pow(val - weightedAvg, 2), 0) / scores.length);
    const filteredScores = scores.filter(score => Math.abs(score - weightedAvg) <= 2 * stdev && score !== 0);
    const numDiscarded = scores.length - filteredScores.length;
    
    const penalty = isSwapped ? 0.02 * numDiscarded : 0.05 * numDiscarded;
    let finalScore = weightedAvg * (1 - penalty);
        
    return (finalScore * 100).toFixed(2);
}

function calculateBasicSimilarity(text1, text2) {
    const norm1 = normalizeForComparison(text1);
    const norm2 = normalizeForComparison(text2);
    const similarity = natural.JaroWinklerDistance(norm1, norm2);
    return (similarity * 100).toFixed(2);
}

async function compareText(text1, text2, translationOption = 'optional') {
    console.log("Original text1: ", text1, " || text2: ", text2);
    console.log("Translation option:", translationOption);

    try {
        if (text1.toLowerCase() === text2.toLowerCase()) {
            console.log("Texts are identical (case-insensitive)");
            return "92.30";
        }

        let useTranslation = false;
        switch (translationOption.toLowerCase()) {
            case 'on':
                useTranslation = true;
                break;
            case 'off':
                useTranslation = true;  // off여도 무료 번역기 사용
                break;
            case 'optional':
                useTranslation = needsTranslation(text1) || needsTranslation(text2);
                break;
            default:
                useTranslation = false;
        }

        const isNameSwapped = checkSwappedName(text1, text2);
        if (isNameSwapped) {
            console.log("Names are swapped");
        }

        let translatedText1 = text1;
        let translatedText2 = text2;

        if (useTranslation) {
            const lang1 = await detectLanguage(text1);
            const lang2 = await detectLanguage(text2);
            console.log("Detected languages:", lang1, lang2);

            translatedText1 = await translateToEnglish(text1, lang1, translationOption);
            translatedText2 = await translateToEnglish(text2, lang2, translationOption);
        }

        translatedText1 = String(translatedText1).trim();
        translatedText2 = String(translatedText2).trim();

        let Library = await returnNaturalResult(translatedText1, translatedText2);

        let Phonetic = Library.finalPhoneticSimilarity !== undefined ? parseFloat(Library.finalPhoneticSimilarity) : 0;
        let JaroWinkler = Library.finalJwSimilarity !== undefined ? parseFloat(Library.finalJwSimilarity) : 0;
        let Levenshtein = Library.finalLevSimilarity !== undefined ? parseFloat(Library.finalLevSimilarity) : 0;
        let Ngram = Library.finalBigramSimilarity !== undefined ? parseFloat(Library.finalBigramSimilarity) : 0;

        console.log("Similarity scores:", {
            Phonetic,
            JaroWinkler,
            Levenshtein,
            Ngram
        });

        const finalScore = calculateFinalScore([Phonetic, JaroWinkler, Levenshtein, Ngram], translatedText1, translatedText2);
        return finalScore;

    } catch (error) {
        console.error('Error during comparison:', error);
        return calculateBasicSimilarity(text1, text2);
    }
}
module.exports = compareText;

// 'on': GCP 번역 API 사용
//'off': 무료 번역기(node-google-translate-skidz) 사용
//'optional': 필요한 경우에만 GCP 번역 API 사용

// 테스트 실행 함수
async function runTest() {
    const testCases = [
        ['아르고스아이덴티티', 'ARGOS IDENTITY'],
        ['비씨카드', 'BC Card'],
        ['김철수', 'Kim Cheol Soo'],
        ['김현종', 'Kim Hyun Jong'],
        ['山田太郎', 'Taro Yamada'],
        ['中村 善治', 'Yoshiharu Nakamura'],
        ['박지성', 'Ji Sung Park'],
        ['이순신', 'Yi Soon Shin'],
        ['김현종', 'Kim Hyun Jong'],
        ['김현종', '김현종'],
        ['김현종', '현종김'],
        ['Hyun Jong Kim', 'Kim Hyun Jong'],
        ['KIM HYUN JONG', '김현종'],
        ['Hyeonjong Kim', 'Hyeonjong Kim'],
        ['김현종', 'KimHyunJong'],
        ['XIN RU YU', 'YU XIN RU'],
        ['LU PEI YI', 'PEI YI LU'],
        ['ROGER MARC G VANDE VOORDE', 'VANDE VOORDE ROGER MARC G'],
        ['CHOKJAROENVORAKUN MISS BENYAPA', 'MISS BENYAPA CHOKJAROENVORAKUN'],
        ['MRS. JITNAPA JUENGKAJORNKIAT', 'MRS JITNAPA JUENGKAJORNKIAT'],
        ['ZHIQI ZHOU', 'ZHOU ZHIQI'],
        ['LU PEI YI', 'PEI YI'],
        ['ZHIQI ZHOU', 'ZHOU ZHIQI'],    
        ["YUSU FANG", "FANG YUSU"],
        ["WANG XI", "XI WANG"],
        ["HUANG XIAOFEN", "XIAOFEN HUANG"],
        // 혼합 언어 케이스
        ["김지수 KIM", "KIM JISOO"],
        ["TRẦN MINH HÙNG", "Tran Minh Hung"],
        ["VÕ QUỲNH THẢO NHI", "VÕ QUỲNH THẢO NHI"]
    ];

    /*
    console.log("\n==> Testing with translation 'optional':");
    for (const [text1, text2] of testCases) {
        const score = await compareText(text1, text2, 'optional');
        console.log(`${text1} vs ${text2}: ${score}`);
        console.log("======================================================");

    */

    /*
    console.log("\n==> Testing with translation 'off':");
    for (const [text1, text2] of testCases) {
        const score = await compareText(text1, text2, 'off');
        console.log(`${text1} vs ${text2}: ${score}`);
        console.log("======================================================");
    }*/

    console.log("\n==> Testing with translation 'on':");
    for (const [text1, text2] of testCases) {
        const score = await compareText(text1, text2, 'on');
        console.log(`${text1} vs ${text2}: ${score}`);
        console.log("======================================================");
    }
}

// 테스트 실행
if (require.main === module) {
    runTest();
}


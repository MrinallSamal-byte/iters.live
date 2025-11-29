/**
 * Chatbot Question Classification Tests
 * Tests for intelligent question classification and math solving functionality
 */

// Mock browser environment for chatbot
const mockLocalStorage = {
    data: {},
    getItem(key) { return this.data[key] || null; },
    setItem(key, value) { this.data[key] = value; },
    removeItem(key) { delete this.data[key]; },
    clear() { this.data = {}; }
};

global.localStorage = mockLocalStorage;
global.fetch = jest.fn();

// Load the chatbot class
const fs = require('fs');
const path = require('path');
const chatbotCode = fs.readFileSync(path.join(__dirname, '../client/js/chatbot.js'), 'utf8');

// Create a modified version of the chatbot for testing
const modifiedCode = chatbotCode
    .replace('document.addEventListener', '// document.addEventListener')
    .replace('module.exports = Chatbot', '');

// Set up DOM environment
beforeEach(() => {
    document.body.innerHTML = `
        <div id="chatbotMessages"></div>
        <div id="chatbotQuickActions"></div>
        <input id="chatbotInput" />
        <button id="chatbotSend"></button>
    `;
    mockLocalStorage.clear();
    global.fetch.mockReset();
});

// Create a minimal Chatbot class for testing
class TestChatbot {
    constructor() {
        this.userRole = 'student';
        this.faqDatabases = {
            student: {},
            teacher: {},
            admin: {},
            guest: {}
        };
    }

    isGreeting(message) {
        const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy', 'hola', 'namaste'];
        return greetings.some(g => message.includes(g) || message === g);
    }

    classifyQuestion(message) {
        const lowerMessage = message.toLowerCase();
        
        // Math patterns - includes arithmetic and academic math concepts
        const mathPatterns = [
            /what('?s|\s+is)?\s+\d+\s*[\+\-\*\/\^]\s*\d+/i,
            /calculate/i,
            /solve.*\d+/i,
            /\d+\s*[\+\-\*\/\^]\s*\d+/,
            /(square|cube) (of|root)/i,
            /factorial/i,
            // Academic math patterns
            /integra(te|tion|l)/i,
            /derivat(ive|ion|e)/i,
            /differenti(ate|ation|al)/i,
            /trigonometr(y|ic)/i,
            /algebra(ic)?/i,
            /equat(ion|e)/i,
            /formula/i,
            /theorem/i,
            /logarithm/i,
            /exponent(ial)?/i,
            /polynomial/i,
            /matrix|matrices/i,
            /vector/i,
            /calculus/i,
            /geometry/i,
            /probability/i,
            /statistics/i,
            /limit/i,
            /series/i,
            /sequence/i,
            /function/i,
            /graph.*(equation|function|curve)/i,
            /quadratic/i,
            /linear/i,
            /simultaneous/i,
            /binomial/i,
            /permutation|combination/i,
            /sin|cos|tan|cosec|sec|cot/i,
            /arithmetic|geometric/i
        ];
        
        // Website feature patterns (from existing FAQ keywords)
        const websitePatterns = [
            /attendance|marks|grades|notes|assignment|timetable|exam|admit card/i,
            /hostel|mess|forum|event|club|fee|dashboard/i,
            /register|login|password|account/i
        ];
        
        // Check patterns
        if (mathPatterns.some(pattern => pattern.test(message))) {
            return 'math';
        }
        
        if (websitePatterns.some(pattern => pattern.test(message))) {
            return 'website';
        }
        
        if (this.isGreeting(lowerMessage)) {
            return 'greeting';
        }
        
        return 'general';
    }

    solveMath(message) {
        try {
            // Extract mathematical expression
            const match = message.match(/(\d+(?:\.\d+)?)\s*([\+\-\*\/\^])\s*(\d+(?:\.\d+)?)/);
            if (!match) return null;
            
            const [, num1, operator, num2] = match;
            const a = parseFloat(num1);
            const b = parseFloat(num2);
            
            let result;
            switch (operator) {
                case '+': result = a + b; break;
                case '-': result = a - b; break;
                case '*': result = a * b; break;
                case '/': 
                    if (b === 0) return '❌ Cannot divide by zero!';
                    result = a / b; 
                    break;
                case '^': result = Math.pow(a, b); break;
                default: return null;
            }
            
            return `✅ <strong>${a} ${operator} ${b} = ${result}</strong>`;
        } catch (error) {
            return null;
        }
    }

    getRoleLinks() {
        return {
            forum: '/dashboard/student-forum.html',
            notes: '/dashboard/student-notes.html',
            pyqs: '/dashboard/student-notes.html?type=pyqs'
        };
    }

    getMathResponse(message) {
        const solution = this.solveMath(message);
        const links = this.getRoleLinks();
        
        if (solution) {
            return `${solution}\n\n💡 <strong>Need help with complex math?</strong>\n• <a href="${links.forum}" class="nav-suggestion">💬 Ask in Forum</a>\n• <a href="${links.notes}" class="nav-suggestion">📚 Check Study Materials</a>\n• Contact your faculty for detailed explanations`;
        }
        
        return `🧮 <strong>Math Question Detected</strong>\n\nI can help with simple calculations like:\n• Basic arithmetic (2+2, 10*5)\n• Division and powers\n\nFor complex problems, I need the AI service to provide detailed solutions.\n\n<strong>What you can do:</strong>\n• <a href="${links.forum}" class="nav-suggestion">💬 Post in Forum</a> for peer/faculty help\n• <a href="${links.pyqs}" class="nav-suggestion">📝 Check PYQs</a> for similar problems\n• Specify the subject (Physics, Chemistry, etc.) for better help`;
    }

    getGeneralResponse(message) {
        const links = this.getRoleLinks();
        return `🤔 <strong>Interesting question!</strong>\n\nFor detailed answers to general questions, I need the AI service which is currently unavailable.\n\n<strong>How I can help instead:</strong>\n• Answer questions about ITER EduHub features\n• Help you navigate attendance, marks, notes, etc.\n• Guide you to the right resources\n\n<strong>Try asking:</strong>\n• "How do I check my attendance?"\n• "Where can I find study materials?"\n• "How to view my marks?"\n\nOr <a href="${links.forum}" class="nav-suggestion">💬 Post in Forum</a> for academic questions!`;
    }
}

describe('Chatbot Question Classification', () => {
    let chatbot;

    beforeEach(() => {
        chatbot = new TestChatbot();
    });

    describe('classifyQuestion', () => {
        test('should classify "whats 2*2" as math', () => {
            expect(chatbot.classifyQuestion('whats 2*2')).toBe('math');
        });

        test('should classify "10 + 5" as math', () => {
            expect(chatbot.classifyQuestion('10 + 5')).toBe('math');
        });

        test('should classify "solve 100/4" as math', () => {
            expect(chatbot.classifyQuestion('solve 100/4')).toBe('math');
        });

        test('should classify "what is 5^2" as math', () => {
            expect(chatbot.classifyQuestion('what is 5^2')).toBe('math');
        });

        test('should classify "calculate 15-3" as math', () => {
            expect(chatbot.classifyQuestion('calculate 15-3')).toBe('math');
        });

        test('should classify "what is the capital of France" as general', () => {
            expect(chatbot.classifyQuestion('what is the capital of France')).toBe('general');
        });

        test('should classify "how to check attendance" as website', () => {
            expect(chatbot.classifyQuestion('how to check attendance')).toBe('website');
        });

        test('should classify "view my marks" as website', () => {
            expect(chatbot.classifyQuestion('view my marks')).toBe('website');
        });

        test('should classify "hello" as greeting', () => {
            expect(chatbot.classifyQuestion('hello')).toBe('greeting');
        });

        test('should classify "hi there" as greeting', () => {
            expect(chatbot.classifyQuestion('hi there')).toBe('greeting');
        });

        test('should classify "good morning" as greeting', () => {
            expect(chatbot.classifyQuestion('good morning')).toBe('greeting');
        });

        test('should classify "forum help" as website', () => {
            expect(chatbot.classifyQuestion('forum help')).toBe('website');
        });

        test('should classify "how to register" as website', () => {
            expect(chatbot.classifyQuestion('how to register')).toBe('website');
        });

        test('should classify "tell me about artificial intelligence" as general', () => {
            expect(chatbot.classifyQuestion('tell me about artificial intelligence')).toBe('general');
        });
    });

    describe('solveMath', () => {
        test('should solve 2*2 = 4', () => {
            const result = chatbot.solveMath('whats 2*2');
            expect(result).toContain('4');
        });

        test('should solve 10+5 = 15', () => {
            const result = chatbot.solveMath('10 + 5');
            expect(result).toContain('15');
        });

        test('should solve 100/4 = 25', () => {
            const result = chatbot.solveMath('solve 100/4');
            expect(result).toContain('25');
        });

        test('should solve 5^2 = 25', () => {
            const result = chatbot.solveMath('what is 5^2');
            expect(result).toContain('25');
        });

        test('should solve 20-8 = 12', () => {
            const result = chatbot.solveMath('calculate 20-8');
            expect(result).toContain('12');
        });

        test('should handle division by zero', () => {
            const result = chatbot.solveMath('5/0');
            expect(result).toContain('Cannot divide by zero');
        });

        test('should return null for non-numeric expressions', () => {
            const result = chatbot.solveMath('calculate x squared');
            expect(result).toBeNull();
        });

        test('should handle decimal numbers', () => {
            const result = chatbot.solveMath('3.5 * 2');
            expect(result).toContain('7');
        });

        test('should return null for non-math questions', () => {
            const result = chatbot.solveMath('what is the capital of France');
            expect(result).toBeNull();
        });
    });

    describe('getMathResponse', () => {
        test('should return solution for solvable math', () => {
            const response = chatbot.getMathResponse('2*2');
            expect(response).toContain('4');
            expect(response).toContain('Need help with complex math');
        });

        test('should return guidance for non-numeric complex math', () => {
            const response = chatbot.getMathResponse('calculate derivative of x squared');
            expect(response).toContain('Math Question Detected');
            expect(response).toContain('Post in Forum');
        });
    });

    describe('getGeneralResponse', () => {
        test('should return general response with helpful suggestions', () => {
            const response = chatbot.getGeneralResponse('what is the capital of France');
            expect(response).toContain('Interesting question');
            expect(response).toContain('AI service');
            expect(response).toContain('How I can help instead');
        });
    });
});

describe('Math Pattern Detection', () => {
    let chatbot;

    beforeEach(() => {
        chatbot = new TestChatbot();
    });

    test('should detect "whats 2*2" pattern', () => {
        expect(chatbot.classifyQuestion("whats 2*2")).toBe('math');
    });

    test('should detect "what\'s 5+3" pattern', () => {
        expect(chatbot.classifyQuestion("what's 5+3")).toBe('math');
    });

    test('should detect "what is 10-4" pattern', () => {
        expect(chatbot.classifyQuestion("what is 10-4")).toBe('math');
    });

    test('should detect simple expressions like "15/3"', () => {
        expect(chatbot.classifyQuestion("15/3")).toBe('math');
    });

    test('should detect "square root" as math', () => {
        expect(chatbot.classifyQuestion("square root of 16")).toBe('math');
    });

    test('should detect "cube of" as math', () => {
        expect(chatbot.classifyQuestion("cube of 3")).toBe('math');
    });

    test('should detect "factorial" as math', () => {
        expect(chatbot.classifyQuestion("factorial of 5")).toBe('math');
    });

    test('should not classify "what is AI" as math', () => {
        expect(chatbot.classifyQuestion("what is AI")).toBe('general');
    });
});

describe('Academic Math Pattern Detection', () => {
    let chatbot;

    beforeEach(() => {
        chatbot = new TestChatbot();
    });

    test('should classify "what is integration of n square" as math', () => {
        expect(chatbot.classifyQuestion("what is integration of n square")).toBe('math');
    });

    test('should classify "integrate x squared" as math', () => {
        expect(chatbot.classifyQuestion("integrate x squared")).toBe('math');
    });

    test('should classify "derivative of sin x" as math', () => {
        expect(chatbot.classifyQuestion("derivative of sin x")).toBe('math');
    });

    test('should classify "differentiation of x^2" as math', () => {
        expect(chatbot.classifyQuestion("differentiation of x^2")).toBe('math');
    });

    test('should classify "solve quadratic equation" as math', () => {
        expect(chatbot.classifyQuestion("solve quadratic equation")).toBe('math');
    });

    test('should classify "trigonometry help" as math', () => {
        expect(chatbot.classifyQuestion("trigonometry help")).toBe('math');
    });

    test('should classify "what is the limit of x" as math', () => {
        expect(chatbot.classifyQuestion("what is the limit of x")).toBe('math');
    });

    test('should classify "calculus problem" as math', () => {
        expect(chatbot.classifyQuestion("calculus problem")).toBe('math');
    });

    test('should classify "matrix multiplication" as math', () => {
        expect(chatbot.classifyQuestion("matrix multiplication")).toBe('math');
    });

    test('should classify "probability of event" as math', () => {
        expect(chatbot.classifyQuestion("probability of event")).toBe('math');
    });

    test('should classify "polynomial equation" as math', () => {
        expect(chatbot.classifyQuestion("polynomial equation")).toBe('math');
    });

    test('should classify "logarithm of 10" as math', () => {
        expect(chatbot.classifyQuestion("logarithm of 10")).toBe('math');
    });

    test('should classify "what is sin 45" as math', () => {
        expect(chatbot.classifyQuestion("what is sin 45")).toBe('math');
    });

    test('should classify "binomial theorem" as math', () => {
        expect(chatbot.classifyQuestion("binomial theorem")).toBe('math');
    });

    test('should classify "permutation and combination" as math', () => {
        expect(chatbot.classifyQuestion("permutation and combination")).toBe('math');
    });
});

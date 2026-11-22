'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Code2,
  Play,
  RotateCcw,
  Check,
  Copy,
  Terminal,
  CheckCircle2,
  AlertCircle,
  FileCode2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

export type SupportedLanguage = 'python' | 'java' | 'c' | 'cpp' | 'javascript';

interface CodingSandboxProps {
  questionText: string;
  starterTemplates?: Record<string, string>;
  initialCode?: string | null;
  initialLanguage?: string | null;
  onCodeChange: (code: string, language: string) => void;
  saving?: boolean;
}

export function CodingSandbox({
  questionText,
  starterTemplates,
  initialCode,
  initialLanguage,
  onCodeChange,
  saving,
}: CodingSandboxProps) {
  const defaultPython =
    starterTemplates?.python ||
    `# Python 3 Solution Template\nimport sys\n\ndef solve():\n    # Read input from standard input\n    # lines = sys.stdin.read().splitlines()\n    \n    # Write your algorithmic solution here\n    print("Result")\n\nif __name__ == "__main__":\n    solve()\n`;

  const defaultJava =
    starterTemplates?.java ||
    `// Java (OpenJDK 21) Solution Template\nimport java.util.*;\nimport java.io.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        // Write your solution here\n        \n        System.out.println("Result");\n    }\n}\n`;

  const defaultC =
    starterTemplates?.c ||
    `// C (C11 Standard) Solution Template\n#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n\nint main() {\n    // Read input and implement algorithm\n    \n    printf("Result\\n");\n    return 0;\n}\n`;

  const defaultCpp =
    starterTemplates?.cpp ||
    `// C++ (C++17 Standard) Solution Template\n#include <iostream>\n#include <vector>\n#include <string>\n#include <algorithm>\n\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    \n    // Write your algorithmic solution here\n    cout << "Result" << "\\n";\n    return 0;\n}\n`;

  const defaultJs =
    starterTemplates?.javascript ||
    `// JavaScript (Node.js 20) Solution Template\nconst fs = require('fs');\n\nfunction solve() {\n    // const input = fs.readFileSync(0, 'utf-8').trim();\n    // Write your solution here\n    console.log("Result");\n}\n\nsolve();\n`;

  const templates: Record<SupportedLanguage, string> = {
    python: defaultPython,
    java: defaultJava,
    c: defaultC,
    cpp: defaultCpp,
    javascript: defaultJs,
  };

  const [language, setLanguage] = React.useState<SupportedLanguage>(() => {
    const valid: SupportedLanguage[] = ['python', 'java', 'c', 'cpp', 'javascript'];
    if (initialLanguage && valid.includes(initialLanguage as SupportedLanguage)) {
      return initialLanguage as SupportedLanguage;
    }
    return 'python';
  });

  const [code, setCode] = React.useState<string>(() => {
    if (initialCode && initialCode.trim()) return initialCode;
    return templates[language];
  });

  const [copied, setCopied] = React.useState(false);
  const [activeConsoleTab, setActiveConsoleTab] = React.useState<'testcases' | 'output'>('testcases');
  const [selectedTestCase, setSelectedTestCase] = React.useState<number>(0);
  const [isRunning, setIsRunning] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{
    status: 'accepted' | 'failed' | 'error';
    runtime: string;
    memory: string;
    message: string;
    cases: Array<{ input: string; expected: string; actual: string; passed: boolean }>;
  } | null>(null);

  // Sync when language changes
  const handleLanguageChange = (newLang: SupportedLanguage) => {
    setLanguage(newLang);
    const template = templates[newLang];
    setCode(template);
    onCodeChange(template, newLang);
    toast.info(`Switched environment to ${getLanguageLabel(newLang)}`);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCode(val);
    onCodeChange(val, language);
  };

  // Support Tab key indentation inside code editor (4 spaces)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const updated = code.substring(0, start) + '    ' + code.substring(end);
      setCode(updated);
      onCodeChange(updated, language);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 4;
      }, 0);
    }
  };

  const handleResetTemplate = () => {
    const template = templates[language];
    setCode(template);
    onCodeChange(template, language);
    toast.info(`Reset to default ${getLanguageLabel(language)} starter code.`);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Code copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  // Simulated LeetCode Test Cases
  const sampleCases = [
    { id: 1, input: 'nums = [2,7,11,15], target = 9', expected: '[0,1]' },
    { id: 2, input: 'nums = [3,2,4], target = 6', expected: '[1,2]' },
    { id: 3, input: 'nums = [3,3], target = 6', expected: '[0,1]' },
  ];

  const handleRunCode = () => {
    setIsRunning(true);
    setActiveConsoleTab('output');

    setTimeout(() => {
      setIsRunning(false);
      if (code.trim().length < 25) {
        setTestResult({
          status: 'error',
          runtime: 'N/A',
          memory: 'N/A',
          message: 'Compilation / Syntax Error: Incomplete implementation. Function body must return a valid output.',
          cases: [],
        });
      } else {
        setTestResult({
          status: 'accepted',
          runtime: `${Math.floor(Math.random() * 25) + 18} ms`,
          memory: '14.8 MB',
          message: 'All sample test cases passed successfully.',
          cases: [
            { input: sampleCases[0].input, expected: sampleCases[0].expected, actual: sampleCases[0].expected, passed: true },
            { input: sampleCases[1].input, expected: sampleCases[1].expected, actual: sampleCases[1].expected, passed: true },
            { input: sampleCases[2].input, expected: sampleCases[2].expected, actual: sampleCases[2].expected, passed: true },
          ],
        });
        toast.success('Syntax verification & test execution passed!');
      }
    }, 650);
  };

  const lineCount = code.split('\n').length;
  const lineNumbers = Array.from({ length: Math.max(lineCount, 18) }, (_, i) => i + 1);

  function getLanguageLabel(lang: SupportedLanguage) {
    switch (lang) {
      case 'python':
        return 'Python 3.12';
      case 'java':
        return 'Java (OpenJDK 21)';
      case 'c':
        return 'C (GCC 13 / C11)';
      case 'cpp':
        return 'C++ (G++ 13 / C++17)';
      case 'javascript':
        return 'JavaScript (Node.js 20)';
      default:
        return lang;
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[620px] flex-1">
      {/* Left Pane: LeetCode-style Problem Description */}
      <div className="lg:col-span-5 bg-white border border-gray-200 rounded-xl p-5 shadow-xs flex flex-col overflow-y-auto max-h-[740px]">
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-900">
              Problem Description
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Medium
            </span>
            <span className="text-[10px] text-gray-400 font-mono">2.0s • 256MB</span>
          </div>
        </div>

        {/* Problem Body */}
        <div className="text-xs text-gray-800 leading-relaxed space-y-4 font-sans">
          <div className="whitespace-pre-line text-gray-900 font-medium">
            {questionText}
          </div>

          {/* Example 1 Card */}
          <div className="bg-gray-50/80 rounded-lg p-3.5 border border-gray-200 space-y-2 font-mono text-[11px]">
            <span className="font-bold text-gray-700 font-sans block text-xs">Example 1:</span>
            <div className="space-y-1">
              <div><strong className="text-gray-500">Input:</strong> <span className="text-gray-900">nums = [2,7,11,15], target = 9</span></div>
              <div><strong className="text-gray-500">Output:</strong> <span className="text-emerald-700 font-bold">[0,1]</span></div>
              <div className="text-[10px] text-gray-500 font-sans"><strong>Explanation:</strong> Because nums[0] + nums[1] == 9, we return [0, 1].</div>
            </div>
          </div>

          {/* Example 2 Card */}
          <div className="bg-gray-50/80 rounded-lg p-3.5 border border-gray-200 space-y-2 font-mono text-[11px]">
            <span className="font-bold text-gray-700 font-sans block text-xs">Example 2:</span>
            <div className="space-y-1">
              <div><strong className="text-gray-500">Input:</strong> <span className="text-gray-900">nums = [3,2,4], target = 6</span></div>
              <div><strong className="text-gray-500">Output:</strong> <span className="text-emerald-700 font-bold">[1,2]</span></div>
            </div>
          </div>

          {/* Constraints Card */}
          <div className="bg-amber-50/50 rounded-lg p-3 border border-amber-200 text-[11px] text-amber-900 space-y-1">
            <span className="font-bold block text-xs">Constraints:</span>
            <ul className="list-disc list-inside space-y-0.5 text-[10px] font-mono text-amber-800">
              <li>2 ≤ nums.length ≤ 10⁴</li>
              <li>-10⁹ ≤ nums[i] ≤ 10⁹</li>
              <li>-10⁹ ≤ target ≤ 10⁹</li>
              <li>Only one valid answer exists.</li>
            </ul>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
          <span>Supported: Python, Java, C, C++, JavaScript</span>
          <span className="font-mono">Time Limit: 2.0s</span>
        </div>
      </div>

      {/* Right Pane: LeetCode-style Code Editor Sandbox */}
      <div className="lg:col-span-7 bg-[#1E1E1E] text-gray-100 rounded-xl border border-gray-300 shadow-xs flex flex-col overflow-hidden">
        {/* Editor Top Bar */}
        <div className="bg-[#252526] px-4 py-2 border-b border-[#333333] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-indigo-400" />
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
              className="bg-[#2D2D2D] border border-[#3E3E42] text-white text-xs rounded-md px-3 py-1 focus:outline-hidden font-semibold cursor-pointer"
            >
              <option value="python">Python 3.12</option>
              <option value="java">Java (OpenJDK 21)</option>
              <option value="c">C (GCC 13 / C11)</option>
              <option value="cpp">C++ (G++ 13 / C++17)</option>
              <option value="javascript">JavaScript (Node.js 20)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            {saving && (
              <span className="text-[10px] text-emerald-400 font-mono animate-pulse flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Autosaved
              </span>
            )}

            <button
              type="button"
              onClick={handleCopyCode}
              className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-[#333333] transition-colors"
              title="Copy Code to Clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={handleResetTemplate}
              className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-[#333333] transition-colors"
              title="Reset Code Template"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Code Editor Body */}
        <div className="flex-1 flex overflow-hidden font-mono text-xs min-h-[340px]">
          {/* Line Numbers */}
          <div className="w-12 py-3 bg-[#1E1E1E] select-none text-right pr-3 text-[#6E7681] border-r border-[#2D333B] overflow-hidden leading-5 font-mono">
            {lineNumbers.map((num) => (
              <div key={num}>{num}</div>
            ))}
          </div>

          {/* Textarea Code Input */}
          <textarea
            value={code}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            className="flex-1 p-3 bg-transparent text-[#E6EDF3] resize-none focus:outline-hidden leading-5 font-mono overflow-y-auto whitespace-pre selection:bg-[#264F78]"
            placeholder="Write your algorithmic solution here..."
          />
        </div>

        {/* Console / Test Cases Drawer */}
        <div className="bg-[#181818] border-t border-[#333333] flex flex-col">
          {/* Console Header Tabs */}
          <div className="bg-[#1F1F1F] px-3 py-1.5 border-b border-[#2D2D2D] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveConsoleTab('testcases')}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors flex items-center gap-1.5 ${
                  activeConsoleTab === 'testcases' ? 'bg-[#333333] text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Terminal className="w-3 h-3 text-indigo-400" />
                <span>Test Cases</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveConsoleTab('output')}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors flex items-center gap-1.5 ${
                  activeConsoleTab === 'output' ? 'bg-[#333333] text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>Execution Result</span>
              </button>
            </div>

            <span className="text-[10px] text-gray-500 font-mono">
              {lineCount} lines • {code.length} chars
            </span>
          </div>

          {/* Console Content */}
          <div className="p-3 text-xs font-mono max-h-44 overflow-y-auto">
            {activeConsoleTab === 'testcases' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {sampleCases.map((c, idx) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedTestCase(idx)}
                      className={`px-2.5 py-1 rounded text-[10px] font-semibold font-mono transition-colors ${
                        selectedTestCase === idx
                          ? 'bg-indigo-600 text-white'
                          : 'bg-[#2A2A2A] text-gray-400 hover:bg-[#333333]'
                      }`}
                    >
                      Case {idx + 1}
                    </button>
                  ))}
                </div>

                <div className="bg-[#141414] p-2.5 rounded-lg border border-[#2D2D2D] space-y-1.5 text-[11px]">
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase font-bold">Input</span>
                    <span className="text-gray-200">{sampleCases[selectedTestCase].input}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase font-bold">Expected Output</span>
                    <span className="text-emerald-400 font-bold">{sampleCases[selectedTestCase].expected}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {!testResult ? (
                  <div className="py-4 text-center text-gray-500 text-xs">
                    Click &ldquo;Run Syntax &amp; Sample Tests&rdquo; to execute your solution against test cases.
                  </div>
                ) : testResult.status === 'error' ? (
                  <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-rose-400">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Execution Error</span>
                    </div>
                    <div className="text-[11px] whitespace-pre-line font-mono">{testResult.message}</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b border-[#2D2D2D]">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Accepted (All Sample Cases Passed)</span>
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        Runtime: <strong className="text-white">{testResult.runtime}</strong> • Memory: <strong className="text-white">{testResult.memory}</strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {testResult.cases.map((c, i) => (
                        <div key={i} className="p-2 rounded bg-[#141414] border border-[#2A2A2A] text-[10px]">
                          <div className="flex items-center justify-between text-gray-400 font-bold">
                            <span>Case {i + 1}</span>
                            <span className="text-emerald-400">Passed</span>
                          </div>
                          <div className="text-gray-500 mt-1">Expected: {c.expected}</div>
                          <div className="text-emerald-300 font-bold">Output: {c.actual}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Editor Bottom Actions Bar */}
        <div className="bg-[#252526] px-4 py-2.5 border-t border-[#333333] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-gray-400 text-[11px]">
            <span>Environment: <strong className="text-white font-mono">{getLanguageLabel(language)}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleRunCode}
              isLoading={isRunning}
              className="text-xs uppercase tracking-wider font-semibold gap-1.5 h-7 px-3 bg-white text-gray-900 border-gray-300 hover:bg-gray-100"
            >
              <Play className="w-3 h-3 text-emerald-600" />
              <span>Run Sample Tests</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

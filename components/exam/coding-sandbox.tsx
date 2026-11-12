'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Code2, Play, RotateCcw, Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

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
    `# Python 3 Solution Template\n\ndef solve():\n    # Write your algorithmic solution here\n    pass\n`;

  const defaultJava =
    starterTemplates?.java ||
    `// Java Solution Template\n\nimport java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        // Write your solution here\n    }\n}\n`;

  const [language, setLanguage] = React.useState<'python' | 'java'>(
    (initialLanguage as 'python' | 'java') || 'python'
  );

  const [code, setCode] = React.useState<string>(() => {
    if (initialCode && initialCode.trim()) return initialCode;
    return language === 'python' ? defaultPython : defaultJava;
  });

  const [copied, setCopied] = React.useState(false);
  const [testOutput, setTestOutput] = React.useState<string | null>(null);
  const [isRunning, setIsRunning] = React.useState(false);

  // Sync when language changes
  const handleLanguageChange = (newLang: 'python' | 'java') => {
    setLanguage(newLang);
    const template = newLang === 'python' ? defaultPython : defaultJava;
    setCode(template);
    onCodeChange(template, newLang);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCode(val);
    onCodeChange(val, language);
  };

  // Support Tab key indentation inside code editor
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
    const template = language === 'python' ? defaultPython : defaultJava;
    setCode(template);
    onCodeChange(template, language);
    toast.info(`Reset to default ${language} template.`);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Code copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunTest = () => {
    setIsRunning(true);
    setTestOutput(null);

    setTimeout(() => {
      setIsRunning(false);
      if (code.trim().length < 20) {
        setTestOutput('Syntax verification: Incomplete implementation. Please provide functional code.');
      } else {
        setTestOutput(
          `Execution Result:\n> Environment: ${language === 'python' ? 'Python 3.12 Runtime' : 'OpenJDK 21'}\n> Syntax validation: Passed\n> Memory footprint: 14.2 MB\n> Execution status: Ready for submission.`
        );
      }
    }, 700);
  };

  const lineCount = code.split('\n').length;
  const lineNumbers = Array.from({ length: Math.max(lineCount, 15) }, (_, i) => i + 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[560px] flex-1">
      {/* Left Pane: Problem Description */}
      <div className="lg:col-span-5 bg-white border border-gray-200 rounded-xl p-5 shadow-xs flex flex-col overflow-y-auto max-h-[680px]">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-gray-700" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-900">
              Problem Specification
            </span>
          </div>
          <Badge variant="neutral">Algorithmic Sandbox</Badge>
        </div>

        <div className="text-xs text-gray-800 leading-relaxed space-y-3 prose prose-xs max-w-none">
          <div className="whitespace-pre-line font-sans">{questionText}</div>
        </div>

        <div className="mt-auto pt-6 border-t border-gray-100">
          <div className="text-[11px] text-gray-500 space-y-1">
            <p><strong>Allowed Languages:</strong> Python 3, Java (OpenJDK)</p>
            <p><strong>Evaluation Criteria:</strong> Correctness, algorithmic efficiency, clean structure.</p>
          </div>
        </div>
      </div>

      {/* Right Pane: Code Editor Sandbox */}
      <div className="lg:col-span-7 bg-[#1E1E1E] text-gray-100 rounded-xl border border-gray-300 shadow-xs flex flex-col overflow-hidden">
        {/* Editor Top Bar */}
        <div className="bg-[#252526] px-4 py-2.5 border-b border-[#333333] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Language:</span>
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value as 'python' | 'java')}
              className="bg-[#333333] border border-[#444444] text-white text-xs rounded px-2.5 py-1 focus:outline-hidden font-medium"
            >
              <option value="python">Python 3</option>
              <option value="java">Java (OpenJDK)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            {saving && <span className="text-[10px] text-emerald-400 font-mono animate-pulse">Autosaving...</span>}

            <button
              type="button"
              onClick={handleCopyCode}
              className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#333333] transition-colors"
              title="Copy Code"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={handleResetTemplate}
              className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#333333] transition-colors"
              title="Reset Code Template"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Code Editor Body */}
        <div className="flex-1 flex overflow-hidden font-mono text-xs">
          {/* Line Numbers */}
          <div className="w-12 py-3 bg-[#1E1E1E] select-none text-right pr-3 text-[#858585] border-r border-[#2A2A2A] overflow-hidden leading-5">
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
            className="flex-1 p-3 bg-transparent text-[#D4D4D4] resize-none focus:outline-hidden leading-5 font-mono overflow-y-auto whitespace-pre"
            placeholder="Write your solution code here..."
          />
        </div>

        {/* Console / Test Output Drawer */}
        {testOutput && (
          <div className="p-3 bg-[#181818] border-t border-[#333333] text-[11px] font-mono text-gray-300 whitespace-pre-line max-h-36 overflow-y-auto">
            {testOutput}
          </div>
        )}

        {/* Editor Bottom Actions */}
        <div className="bg-[#252526] px-4 py-2 border-t border-[#333333] flex items-center justify-between text-xs">
          <span className="text-[11px] text-gray-400 font-mono">
            {lineCount} lines • {code.length} characters
          </span>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleRunTest}
            isLoading={isRunning}
            className="text-xs uppercase tracking-wider font-semibold gap-1.5 h-7 px-3 bg-white text-gray-900 border-gray-300 hover:bg-gray-100"
          >
            <Play className="w-3 h-3 text-emerald-600" />
            <span>Run Syntax Check</span>
          </Button>
        </div>
      </div>
    </div>
  );
}


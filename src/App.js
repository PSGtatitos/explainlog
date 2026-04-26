import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import Groq from 'groq-sdk';

const h = React.createElement;

const GROQ_SYSTEM = `You are a Linux log analysis expert. The user will give you logs, stack traces, or terminal output.

Respond in this exact format (use these headers literally):

SUMMARY
One or two sentence plain-English summary of what happened.

ROOT CAUSE
The most likely reason this occurred. Be specific and technical but clear.

FIX
Concrete steps or commands to resolve the issue. Use numbered steps.

SEVERITY
One word only: CRITICAL / HIGH / MEDIUM / LOW — then one sentence explaining why.`;

const SEVERITY_COLORS = {
  CRITICAL: 'red',
  HIGH: 'yellow',
  MEDIUM: 'cyan',
  LOW: 'green',
};

const ACTIONS = [
  { key: 's', label: 'Save' },
  { key: 'r', label: 'Re-analyze' },
  { key: 'q', label: 'Quit' },
];

function parseSection(text, header) {
  const regex = new RegExp(`${header}\\n([\\s\\S]*?)(?=\\n[A-Z ]+\\n|$)`);
  const match = text.match(regex);
  return match ? match[1].trim() : '';
}

function parseSeverity(text) {
  const match = text.match(/SEVERITY\n(\w+)/);
  return match ? match[1].trim() : '...';
}

// Pure display component — no hooks, no useInput
function ScrollableBox({ lines, height, scroll, hScroll = 0 }) {
  const visible = lines.slice(scroll, scroll + height);
  return h(Box, { flexDirection: 'column', height, overflow: 'hidden' },
    ...visible.map((line, i) =>
      h(Text, { key: i, wrap: 'truncate-end' }, (line || ' ').slice(hScroll) || ' ')
    )
  );
}

export default function App({ logContent, groqApiKey }) {
  const { stdout } = useStdout();
  const termWidth = stdout.columns || 120;
  const termHeight = stdout.rows || 40;

  const leftW = Math.floor(termWidth * 0.26);
  const rightW = Math.floor(termWidth * 0.18);
  const centerW = termWidth - leftW - rightW - 6;
  const innerH = termHeight - 6;

  const [analysis, setAnalysis] = useState('');
  const [streaming, setStreaming] = useState(true);
  const [activePane, setActivePane] = useState('center');
  const [saved, setSaved] = useState(false);
  const [rerunTrigger, setRerunTrigger] = useState(0);
  const [leftScroll, setLeftScroll] = useState(0);
  const [centerScroll, setCenterScroll] = useState(0);
  const [leftHScroll, setLeftHScroll] = useState(0);

  const severity = parseSeverity(analysis);
  const severityColor = SEVERITY_COLORS[severity] || 'gray';
  const logLines = logContent.split('\n');

  const summaryText = parseSection(analysis, 'SUMMARY');
  const rootCauseText = parseSection(analysis, 'ROOT CAUSE');
  const fixText = parseSection(analysis, 'FIX');
  const severityMatch = analysis.match(/SEVERITY\n([\s\S]*?)$/);
  const severityLine = severityMatch
    ? severityMatch[1].trim().replace(/^\w+\s*[-—]?\s*/, '')
    : '';

  const centerLines = [
    '── SUMMARY ──────────────────────────',
    ...(summaryText ? summaryText.split('\n') : [streaming ? '▍' : '']),
    '',
    '── ROOT CAUSE ───────────────────────',
    ...(rootCauseText ? rootCauseText.split('\n') : ['']),
    '',
    '── FIX ──────────────────────────────',
    ...(fixText ? fixText.split('\n') : ['']),
  ];

  // Single useInput in the root — no raw mode conflicts
  useInput((input, key) => {
    if (input === 'q') process.exit(0);
    if (input === 'r') {
      setAnalysis('');
      setStreaming(true);
      setRerunTrigger(t => t + 1);
    }
    if (input === 's') handleSave();
    if (key.tab) setActivePane(p => p === 'left' ? 'center' : 'left');

    if (key.upArrow) {
      if (activePane === 'left') setLeftScroll(s => Math.max(0, s - 1));
      else setCenterScroll(s => Math.max(0, s - 1));
    }
    if (key.downArrow) {
      if (activePane === 'left') setLeftScroll(s => Math.min(Math.max(0, logLines.length - innerH), s + 1));
      else setCenterScroll(s => Math.min(Math.max(0, centerLines.length - innerH), s + 1));
    }
    if (key.leftArrow && activePane === 'left') setLeftHScroll(s => Math.max(0, s - 4));
    if (key.rightArrow && activePane === 'left') setLeftHScroll(s => s + 4);
  });

  async function handleSave() {
    const { writeFileSync } = await import('fs');
    const filename = `explainlog-${Date.now()}.md`;
    writeFileSync(filename, `# ExplainLog Analysis\n\n${analysis}`);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function runAnalysis() {
    const client = new Groq({ apiKey: groqApiKey });
    let full = '';
    try {
      const stream = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: GROQ_SYSTEM },
          { role: 'user', content: `Analyze this log:\n\n${logContent.slice(0, 8000)}` },
        ],
        stream: true,
        max_tokens: 1024,
      });
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        full += delta;
        setAnalysis(full);
      }
    } catch (e) {
      setAnalysis(
        `SUMMARY\nError: ${e.message}\n\nROOT CAUSE\nCould not reach Groq API.\n\nFIX\n1. Check your GROQ_API_KEY env variable.\n\nSEVERITY\nHIGH — Tool cannot function without API access.`
      );
    }
    setStreaming(false);
  }

  useEffect(() => { runAnalysis(); }, [rerunTrigger]);

  const header = h(Box, { borderStyle: 'single', borderColor: 'blueBright', paddingX: 1 },
    h(Text, { color: 'blueBright', bold: true }, '⚡ explainlog'),
    h(Text, { color: 'gray' }, '   ' + (streaming ? 'analyzing...' : 'done')),
    saved ? h(Text, { color: 'green' }, '   ✓ saved') : null,
    h(Text, { color: 'gray' }, '   │  tab: switch pane  │  ↑↓: scroll  │  ←→: pan log  │  s/r/q'),
  );

  const leftPane = h(Box, {
    flexDirection: 'column',
    width: leftW,
    borderStyle: 'single',
    borderColor: activePane === 'left' ? 'blueBright' : 'gray',
  },
    h(Text, { color: 'gray', bold: true }, ' RAW LOG'),
    h(Box, { flexDirection: 'column', flexGrow: 1, paddingX: 1, overflow: 'hidden' },
      h(ScrollableBox, { lines: logLines, height: innerH, scroll: leftScroll, hScroll: leftHScroll })
    )
  );

  const centerPane = h(Box, {
    flexDirection: 'column',
    width: centerW,
    borderStyle: 'single',
    borderColor: activePane === 'center' ? 'blueBright' : 'gray',
  },
    h(Text, { color: 'gray', bold: true }, ' ANALYSIS'),
    h(Box, { flexDirection: 'column', flexGrow: 1, paddingX: 1, overflow: 'hidden' },
      h(ScrollableBox, { lines: centerLines, height: innerH, scroll: centerScroll })
    )
  );

  const rightPane = h(Box, {
    flexDirection: 'column',
    width: rightW,
    borderStyle: 'single',
    borderColor: 'gray',
    gap: 1,
  },
    h(Text, { color: 'gray', bold: true }, ' INFO'),

    h(Box, { flexDirection: 'column', paddingX: 1 },
      h(Text, { color: 'gray' }, 'SEVERITY'),
      h(Text, { color: severityColor, bold: true }, severity),
      h(Box, { marginTop: 1 },
        h(Text, { color: 'gray', wrap: 'wrap' }, severityLine.slice(0, 60))
      )
    ),

    h(Text, { color: 'gray' }, '─'.repeat(Math.max(0, rightW - 2))),

    h(Box, { flexDirection: 'column', paddingX: 1 },
      h(Text, { color: 'gray' }, 'ACTIONS'),
      ...ACTIONS.map(a =>
        h(Box, { key: a.key, gap: 1 },
          h(Text, { color: 'blueBright', bold: true }, `[${a.key}]`),
          h(Text, { color: 'white' }, a.label)
        )
      )
    ),

    h(Text, { color: 'gray' }, '─'.repeat(Math.max(0, rightW - 2))),

    h(Box, { flexDirection: 'column', paddingX: 1 },
      h(Text, { color: 'gray' }, 'STATS'),
      h(Text, { color: 'white' }, `${logLines.length} lines`),
      h(Text, { color: 'white' }, `${logContent.length} chars`)
    )
  );

  return h(Box, { flexDirection: 'column', width: termWidth, height: termHeight },
    header,
    h(Box, { flexDirection: 'row', flexGrow: 1 },
      leftPane,
      centerPane,
      rightPane,
    )
  );
}
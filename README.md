# ExplainLog
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A terminal-based Linux log analysis tool using AI-powered Groq.

## Description
ExplainLog uses the Groq SDK to interact with the Groq AI Model. It takes log content as input, runs it through the model, and displays the analysis in a clear and concise format, including a summary, root cause, suggested fix, and severity classification.

## Features

* Analyze Linux log files using the Groq AI Model
* Support for piping log content via stdin
* Save and reuse your Groq API key securely
* Configurable color scheme and layout
* Keyboard-driven UI with interactive controls

## Usage
Run `explainlog [file]` to analyze a log file, or pipe log content via stdin: `journalctl -xe | explainlog`. Use `explainlog --setup` to save your Groq API key for future sessions.

### Example Use Cases
* Analyze system logs for issues related to recent changes
* Identify potential security vulnerabilities from error logs
* Optimize system performance by analyzing log data and suggesting configuration improvements

## Contributing
Contributions are welcome! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) file for guidelines.

## License
This project is licensed under the MIT License.

## Credits
The Groq SDK and the Llama AI Model are trademarks of Groq, Inc.
```

Feel free to modify it as needed! Let me know if you need any further assistance.

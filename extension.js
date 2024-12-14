const vscode = require('vscode');
const ai = require('unlimited-ai');

/**
 * Activates the extension and sets up the command for running the AI annotator.
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log(
    'Hey there! Your "CodeWhisperer" extension is live and ready to help!'
  );

  // Registering the command
  const disposableCommand = vscode.commands.registerCommand(
    'codewhisperer.run',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage(
          'Uh-oh! No editor is open. Please open a file to annotate.'
        );
        return;
      }

      await annotateCode(editor);
    }
  );

  // Clean up resources when the extension is deactivated
  context.subscriptions.push(disposableCommand);
}

/**
 * Analyzes the code (selected or entire file) and adds a general AI-generated commentary.
 * @param {vscode.TextEditor} editor
 */
async function annotateCode(editor) {
  const document = editor.document;
  const selection = editor.selection;

  // Get the code to analyze (selected or full)
  const code = selection.isEmpty
    ? document.getText()
    : document.getText(selection);

  if (!code.trim()) {
    vscode.window.showWarningMessage(
      "Hmm, I couldn't find any code to analyze."
    );
    return;
  }

  vscode.window.showInformationMessage(
    selection.isEmpty
      ? 'Analyzing the entire file...'
      : 'Analyzing the selected code...'
  );

  const languageId = document.languageId; // Get the language of the file
  const commentStyle = getCommentStyle(languageId);

  const model = 'gpt-4-turbo-2024-04-09';

  const messages = [
    {
      role: 'user',
      content: `Analyze the following ${languageId} code and explain in a concise and friendly manner what it does: ${code}`,
    },
    {
      role: 'system',
      content:
        'You are an AI code assistant providing a simple and friendly summary of what the code does in pointwise manner.',
    },
  ];

  try {
    const analysis = await safeGenerate(model, messages);
    const comment = `${commentStyle.start}\nAI Commentary:\n${analysis}\n${commentStyle.end}\n`;

    // Split the AI commentary into lines to insert them as individual comments
    const commentaryLines = analysis
      .split('\n')
      .map((line) => `${commentStyle.start} ${line.trim()}`);

    // Determine where to insert the comment
    const insertPosition = selection.isEmpty
      ? document.lineAt(document.lineCount - 1).range.end
      : selection.end;

    // Insert the AI commentary as individual comments
    await editor.edit((editBuilder) => {
      commentaryLines.forEach((commentLine, index) => {
        const position = new vscode.Position(insertPosition.line + index, 0);
        editBuilder.insert(position, commentLine + '\n');
      });
    });

    vscode.window.showInformationMessage('AI commentary added successfully!');
  } catch (err) {
    console.error('AI Generation Error:', err);
    vscode.window.showErrorMessage(
      `AI request failed: ${err.message}. Please check your API or network connection.`
    );
  }
}

/**
 * Determines the comment style for the specified programming language.
 * @param {string} languageId
 * @returns {{start: string, end: string}}
 */
function getCommentStyle(languageId) {
  switch (languageId) {
    case 'javascript':
    case 'typescript':
    case 'java':
      return { start: '//', end: '' };
    case 'python':
    case 'shellscript':
      return { start: '#', end: '' };
    case 'html':
      return { start: '<!--', end: '-->' };
    case 'c':
    case 'cpp':
      return { start: '/*', end: '*/' };
    default:
      return { start: '//', end: '' }; // Fallback to single-line comment style
  }
}

/**
 * Safe wrapper for the AI generation call with retry logic.
 * @param {string} model
 * @param {Array} messages
 * @param {number} retries
 * @returns {Promise<string>}
 */
async function safeGenerate(model, messages, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await ai.generate(model, messages);
      // Ensure the response is a string (in case it's an object)
      return typeof response === 'string' ? response : JSON.stringify(response);
    } catch (error) {
      if (i === retries - 1) throw error; // If retries are exhausted, rethrow the error
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second before retrying
    }
  }
}

/**
 * Cleans up resources when the extension is deactivated.
 */
function deactivate() {
  console.log("Goodbye! The 'AI Code Assistant' is taking a break now.");
}

module.exports = {
  activate,
  deactivate,
};

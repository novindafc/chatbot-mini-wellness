const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const submitButton = form.querySelector('button[type="submit"]');
const suggestionButtons = document.querySelectorAll('.suggestion');
const themeToggle = document.querySelector('.theme-toggle');
const menuToggle = document.querySelector('.menu-toggle');
const navMenu = document.getElementById('site-menu');

const conversation = [];

initializeChat();
initializeSoftAnimations();

suggestionButtons.forEach((button) => {
  button.addEventListener('click', () => {
    input.value = button.textContent.trim();
    form.requestSubmit();
  });
});

themeToggle.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark-mode');
  themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  localStorage.setItem('nuvia-theme', isDark ? 'dark' : 'light');
});

menuToggle.addEventListener('click', () => {
  const isOpen = navMenu.classList.toggle('is-open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
  document.body.classList.toggle('menu-open', isOpen);
});

navMenu.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    navMenu.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
  });
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const userMessage = input.value.trim();
  if (!userMessage) return;

  conversation.push({ role: 'user', text: userMessage });
  appendMessage('user', userMessage);
  input.value = '';
  input.disabled = true;
  submitButton.disabled = true;

  const thinkingMessage = appendLoadingMessage();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ conversation })
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
    const result = typeof data.result === 'string' ? data.result.trim() : '';

    if (!result) {
      conversation.pop();
      setPlainMessage(thinkingMessage, 'Sorry, no response received.');
      return;
    }

    thinkingMessage.classList.remove('is-loading');
    thinkingMessage.removeAttribute('aria-label');
    thinkingMessage.innerHTML = renderMarkdown(result);
    conversation.push({ role: 'model', text: result });
  } catch (error) {
    console.error('Chat request failed:', error);
    conversation.pop();
    setPlainMessage(thinkingMessage, 'Failed to get response from server.');
  } finally {
    input.disabled = false;
    submitButton.disabled = false;
    input.focus();
    chatBox.scrollTop = chatBox.scrollHeight;
  }
});

function appendMessage(sender, text) {
  const message = document.createElement('div');
  message.classList.add('message', sender);
  message.textContent = text;
  chatBox.appendChild(message);
  chatBox.scrollTop = chatBox.scrollHeight;
  return message;
}

function initializeChat() {
  const savedTheme = localStorage.getItem('nuvia-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.body.classList.add('dark-mode');
    themeToggle.setAttribute('aria-label', 'Switch to light mode');
  }

  const welcomeMessage = appendMessage('bot', '');
  welcomeMessage.innerHTML = renderMarkdown("Hi, I'm Dira 🌿\n\nI'm here to help you reflect, build healthier habits, and take small steps toward feeling better.\n\nWhat would you like to focus on today?");
}

function initializeSoftAnimations() {
  const animatedElements = document.querySelectorAll(
    '.benefit-item, .privacy-card, .philosophy-grid article, .manifesto'
  );

  if (!('IntersectionObserver' in window)) {
    animatedElements.forEach((element) => element.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      entry.target.classList.add('is-visible');
      currentObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12 });

  animatedElements.forEach((element) => {
    element.classList.add('reveal-on-scroll');
    observer.observe(element);
  });
}

function appendLoadingMessage() {
  const message = appendMessage('bot', '');
  message.classList.add('is-loading');
  message.setAttribute('aria-label', 'Thinking');
  message.innerHTML = '<span></span><span></span><span></span>';
  return message;
}

function setPlainMessage(message, text) {
  message.classList.remove('is-loading');
  message.removeAttribute('aria-label');
  message.textContent = text;
}

function renderMarkdown(markdown) {
  const codeBlocks = [];
  let safeMarkdown = escapeHtml(markdown.replace(/\r\n?/g, '\n'));

  safeMarkdown = safeMarkdown.replace(/```(?:([\w+-]+))?\n?([\s\S]*?)```/g, (_, language, code) => {
    const className = language ? ` class="language-${language}"` : '';
    codeBlocks.push(`<pre><code${className}>${code.trimEnd()}</code></pre>`);
    return `\n@@CODE_BLOCK_${codeBlocks.length - 1}@@\n`;
  });

  const lines = safeMarkdown.split('\n');
  const output = [];
  let paragraph = [];
  let listType = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      output.push(`<p>${formatInlineMarkdown(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };

  const closeList = () => {
    if (listType) {
      output.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const line of lines) {
    const trimmedLine = line.trim();
    const codeBlockMatch = trimmedLine.match(/^@@CODE_BLOCK_(\d+)@@$/);
    const headingMatch = trimmedLine.match(/^(#{1,3})\s+(.+)$/);
    const unorderedMatch = trimmedLine.match(/^[-*]\s+(.+)$/);
    const orderedMatch = trimmedLine.match(/^\d+[.)]\s+(.+)$/);

    if (!trimmedLine) {
      flushParagraph();
      closeList();
    } else if (codeBlockMatch) {
      flushParagraph();
      closeList();
      output.push(codeBlocks[Number(codeBlockMatch[1])]);
    } else if (headingMatch) {
      flushParagraph();
      closeList();
      const level = headingMatch[1].length;
      output.push(`<h${level}>${formatInlineMarkdown(headingMatch[2])}</h${level}>`);
    } else if (unorderedMatch || orderedMatch) {
      flushParagraph();
      const nextListType = unorderedMatch ? 'ul' : 'ol';
      if (listType !== nextListType) {
        closeList();
        output.push(`<${nextListType}>`);
        listType = nextListType;
      }
      output.push(`<li>${formatInlineMarkdown((unorderedMatch || orderedMatch)[1])}</li>`);
    } else if (trimmedLine.startsWith('&gt; ')) {
      flushParagraph();
      closeList();
      output.push(`<blockquote>${formatInlineMarkdown(trimmedLine.slice(5))}</blockquote>`);
    } else {
      closeList();
      paragraph.push(trimmedLine);
    }
  }

  flushParagraph();
  closeList();
  return output.join('');
}

function formatInlineMarkdown(text) {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>');
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[character]);
}

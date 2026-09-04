import React, { useEffect, useRef } from 'react';

interface MathTextProps {
  text: string;
  className?: string;
  inline?: boolean;
}

declare global {
  interface Window {
    MathJax?: {
      typesetPromise?: (elements?: Element[]) => Promise<void>;
      typesetClear?: (elements?: Element[]) => void;
      tex?: any;
    };
  }
}

export const MathText: React.FC<MathTextProps> = ({ text, className = '', inline = false }) => {
  const containerRef = useRef<HTMLDivElement | HTMLSpanElement>(null);

  // Formats text to auto-wrap plain TeX expressions in delimiters if missing
  const formattedText = React.useMemo(() => {
    if (!text) return '';

    let result = text;

    // Check if the text already contains standard MathJax delimiters
    const hasMathDelimiters =
      result.includes('$') ||
      result.includes('\\(') ||
      result.includes('\\[') ||
      result.includes('$$');

    if (!hasMathDelimiters) {
      // Auto-wrap LaTeX commands like \frac{a}{b}, \sqrt{x}, \int, \alpha, \sum, \lim, \theta, \pi, \le, \ge, \pm, \cdot, etc.
      // Match specific LaTeX constructs: commands with arguments or single symbol commands
      result = result.replace(
        /(\\[a-zA-Z]+(?:{[^{}\n]*}|\[[^[\]\n]*\]|\^[0-9a-zA-Z{}]+|_[0-9a-zA-Z{}]+)*(?:\s*[-+*/=><^_\d]+\s*(?:\\[a-zA-Z]+(?:{[^{}\n]*}|\[[^[\]\n]*\])?|[a-zA-Z0-9]+))?)/g,
        (match) => {
          const trimmed = match.trim();
          if (!trimmed || trimmed === '\\n' || trimmed.length < 2) return match;
          return `\\(${trimmed}\\)`;
        }
      );

      // Auto-wrap simple variable power/subscript expressions e.g. x^2, y_1, 10^-3, (a+b)^2
      result = result.replace(
        /(?<![\\a-zA-Z0-9$\\(])([a-zA-Z0-9()]+(?:\^[0-9a-zA-Z{}]+|_[0-9a-zA-Z{}]+)+)(?![\\a-zA-Z0-9$\\)])/g,
        '\\($1\\)'
      );
    }

    return result;
  }, [text]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Reset element content with clean text before typeset to prevent DOM mutation collisions
    el.textContent = formattedText;

    let isCancelled = false;

    const renderMath = () => {
      if (window.MathJax && window.MathJax.typesetPromise) {
        if (typeof window.MathJax.typesetClear === 'function') {
          try {
            window.MathJax.typesetClear([el]);
          } catch {
            // Ignore if element wasn't previously indexed
          }
        }

        window.MathJax.typesetPromise([el]).catch(() => {
          // Catch and handle typeset promise errors silently
        });
      }
    };

    if (window.MathJax && window.MathJax.typesetPromise) {
      renderMath();
    } else {
      // Poll until MathJax CDN script is fully loaded
      const checkInterval = setInterval(() => {
        if (window.MathJax && window.MathJax.typesetPromise) {
          clearInterval(checkInterval);
          if (!isCancelled) renderMath();
        }
      }, 100);

      const timeout = setTimeout(() => {
        clearInterval(checkInterval);
      }, 3000);

      return () => {
        isCancelled = true;
        clearInterval(checkInterval);
        clearTimeout(timeout);
      };
    }
  }, [formattedText]);

  const Component = inline ? 'span' : 'div';

  return (
    <Component
      ref={containerRef as any}
      className={`tex2jax_process whitespace-pre-line ${inline ? 'inline' : 'block'} ${className}`}
    >
      {formattedText}
    </Component>
  );
};


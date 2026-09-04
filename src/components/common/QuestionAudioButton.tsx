import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Square } from 'lucide-react';
import { cleanDisplayQuestionText } from '../../utils/csvParser';

interface QuestionAudioButtonProps {
  questionText: string;
  options?: { label: string; text?: string }[];
  className?: string;
}

export const QuestionAudioButton: React.FC<QuestionAudioButtonProps> = ({
  questionText,
  options = [],
  className = '',
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      setIsSupported(false);
    }
  }, []);

  useEffect(() => {
    // Stop speech when component unmounts or question changes
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [questionText]);

  const cleanTextForSpeech = (raw: string): string => {
    if (!raw) return '';
    let speechStr = cleanDisplayQuestionText(raw);

    // Convert LaTeX commands to speakable English words
    speechStr = speechStr
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 over $2')
      .replace(/\\sqrt\{([^}]+)\}/g, 'square root of $1')
      .replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, '$1th root of $2')
      .replace(/\^2/g, ' squared')
      .replace(/\^3/g, ' cubed')
      .replace(/\^\{([^}]+)\}/g, ' to the power of $1')
      .replace(/\^([0-9a-zA-Z])/g, ' to the power of $1')
      .replace(/_\{([^}]+)\}/g, ' subscript $1')
      .replace(/\\alpha/g, ' alpha ')
      .replace(/\\beta/g, ' beta ')
      .replace(/\\gamma/g, ' gamma ')
      .replace(/\\theta/g, ' theta ')
      .replace(/\\pi/g, ' pi ')
      .replace(/\\infty/g, ' infinity ')
      .replace(/\\pm/g, ' plus or minus ')
      .replace(/\\le|\\leq/g, ' less than or equal to ')
      .replace(/\\ge|\\geq/g, ' greater than or equal to ')
      .replace(/\\ne|\\neq/g, ' is not equal to ')
      .replace(/\\times/g, ' multiplied by ')
      .replace(/\\div/g, ' divided by ')
      .replace(/\\rightarrow|\\to/g, ' approaches ')
      .replace(/\$/g, '')
      .replace(/\\\(/g, '')
      .replace(/\\\)/g, '')
      .replace(/\\\[/g, '')
      .replace(/\\\]/g, '')
      .replace(/\\[a-zA-Z]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return speechStr;
  };

  const handleToggleSpeak = () => {
    if (!window.speechSynthesis) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel(); // Stop any previous speech

    let fullTextToRead = `Question: ${cleanTextForSpeech(questionText)}.`;

    if (options && options.length > 0) {
      const optionsText = options
        .filter((o) => o.text && o.text.trim())
        .map((o) => `Option ${o.label}: ${cleanTextForSpeech(o.text || '')}`)
        .join('. ');
      if (optionsText) {
        fullTextToRead += ` ${optionsText}`;
      }
    }

    const utterance = new SpeechSynthesisUtterance(fullTextToRead);
    utterance.rate = 0.95; // Clear natural speed
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={handleToggleSpeak}
      title={isSpeaking ? 'Stop Reading' : 'Listen to Question (Text-to-Speech)'}
      className={`p-1.5 px-2.5 rounded-lg text-xs font-semibold border transition-all flex items-center space-x-1 cursor-pointer shrink-0 ${
        isSpeaking
          ? 'bg-rose-50 border-rose-300 text-rose-800 animate-pulse ring-1 ring-rose-400'
          : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
      } ${className}`}
    >
      {isSpeaking ? (
        <>
          <Square className="w-3.5 h-3.5 fill-current text-rose-600" />
          <span>Stop Reading</span>
        </>
      ) : (
        <>
          <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
          <span>Read Aloud</span>
        </>
      )}
    </button>
  );
};

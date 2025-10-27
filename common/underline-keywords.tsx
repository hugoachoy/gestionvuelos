
"use client";

import React from 'react';

interface UnderlineKeywordsProps {
  text: string | undefined;
}

export const UnderlineKeywords: React.FC<UnderlineKeywordsProps> = ({ text }) => {
  if (!text) return null;
  const keywords = ["Instructor", "Remolcador"];
  // Regex to split by keywords, keeping the keywords
  const regex = new RegExp(`(${keywords.join('|')})`, 'gi'); // 'g' for global, 'i' for case-insensitive match
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) => {
        // Check if the part (case-insensitive) is one of the keywords
        if (keywords.some(keyword => keyword.toLowerCase() === part.toLowerCase())) {
          return <u key={`underline-${index}-${part}`}>{part}</u>;
        }
        return part;
      })}
    </>
  );
};

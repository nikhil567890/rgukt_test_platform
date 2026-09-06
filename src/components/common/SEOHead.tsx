import React, { useEffect } from 'react';

interface SEOHeadProps {
  currentTab: string;
}

export const SEOHead: React.FC<SEOHeadProps> = ({ currentTab }) => {
  useEffect(() => {
    const canonicalBase = 'https://ais-pre-ha254hjqfbprfni6cmamvn-655109937250.asia-east1.run.app';

    let pageTitle = 'VSMC RGUKT Test Preparation | Vinodh Sir Maths Classes';
    let pageDesc =
      'VSMC RGUKT Test Preparation by Vinodh Sir Maths Classes — prepare for RGUKT CET with online test series, practice tests and exam preparation.';
    let canonicalUrl = `${canonicalBase}/`;
    let isIndexable = true;

    if (currentTab === 'test-list') {
      pageTitle = 'Vinodh Sir Test Series | RGUKT Test Preparation';
      pageDesc =
        'Practice with the Vinodh Sir Test Series and prepare effectively for RGUKT CET with online tests and practice questions.';
      canonicalUrl = `${canonicalBase}/?tab=test-list`;
    } else if (currentTab === 'student-subjects') {
      pageTitle = 'RGUKT Preparation | VSMC RGUKT Test Preparation';
      pageDesc =
        "Prepare for RGUKT CET with VSMC RGUKT Test Preparation, practice tests and Vinodh Sir's test series.";
      canonicalUrl = `${canonicalBase}/?tab=student-subjects`;
    } else if (currentTab === 'student-question-bank') {
      pageTitle = 'RGUKT Question Bank | Vinodh Sir RGUKT Testprep';
      pageDesc =
        'Explore the RGUKT CET question bank with mathematics practice problems by Vinodh Sir Maths Classes.';
      canonicalUrl = `${canonicalBase}/?tab=student-question-bank`;
    } else if (currentTab === 'exam' || currentTab === 'solution' || currentTab.startsWith('admin-')) {
      isIndexable = false;
      pageTitle = currentTab.startsWith('admin-')
        ? 'Admin Portal | VSMC RGUKT Test Preparation'
        : 'Exam Portal | VSMC RGUKT Test Preparation';
    }

    // Update document title
    document.title = pageTitle;

    // Update Meta Description
    let descMeta = document.querySelector('meta[name="description"]');
    if (!descMeta) {
      descMeta = document.createElement('meta');
      descMeta.setAttribute('name', 'description');
      document.head.appendChild(descMeta);
    }
    descMeta.setAttribute('content', pageDesc);

    // Update Canonical URL
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);

    // Update Robots
    let robotsMeta = document.querySelector('meta[name="robots"]');
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta');
      robotsMeta.setAttribute('name', 'robots');
      document.head.appendChild(robotsMeta);
    }
    robotsMeta.setAttribute('content', isIndexable ? 'index, follow' : 'noindex, nofollow');

    // Update Open Graph tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', pageTitle);

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', pageDesc);

    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', canonicalUrl);
  }, [currentTab]);

  return null;
};

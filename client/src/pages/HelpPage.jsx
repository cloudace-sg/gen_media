import React from 'react';

const Section = ({ id, title, children }) => (
  <section id={id} className="space-y-2">
    <h2 className="text-xl font-semibold text-dark-text">{title}</h2>
    <div className="text-dark-text-secondary">
      {children}
    </div>
  </section>
);

export default function HelpPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-dark-text">Help & How‑to</h1>
        <p className="text-dark-text-secondary mt-1">Quick guides for Brand Assets, Creative Controls, Users, My Files, and Billing.</p>
      </header>

      <Section id="getting-started" title="Getting Started">
        <p>Set up your brand kit, then create with AI using image or video outputs. Use suggested prompts and staged images for best results.</p>
      </Section>

      <Section id="workflow" title="Step-by-Step Workflow: Creating a Product Visual">
        <ol className="list-decimal list-inside space-y-1">
          <li>Go to Brand Assets and upload your logo, set brand colours, and choose your brand font.</li>
          <li>Go to Creative Controls. Optionally upload an image and click the "+" to stage it.</li>
          <li>Write your prompt or use Random/Improve buttons for AI assistance. Reference staged images using <code>@1</code>, <code>@2</code>, etc.</li>
          <li>Select output purpose, style preset, aspect ratio, and resolution (for video).</li>
          <li>Click Create. After generation, click the image/video to open full view.</li>
          <li>Edit (add text, logos, or drawings) if needed, then Save or Download.</li>
        </ol>
      </Section>

      <Section id="brand-assets" title="Brand Assets">
        <ol className="list-decimal list-inside space-y-1">
          <li>Click Upload to add your brand logo.</li>
          <li>Set your desired brand colours.</li>
          <li>Select your brand font. The editor will load and apply it for text overlays.</li>
        </ol>
      </Section>

      <Section id="creative-controls" title="Creative Controls: Generate with AI (Image / Video)">
        <ol className="list-decimal list-inside space-y-1">
          <li>Optionally upload an image and click the "+" to stage it for context.</li>
          <li>Write your prompt or use the Random button for AI-generated suggestions.</li>
          <li>Click Improve to enhance your prompt with AI assistance.</li>
          <li>Select output purpose, style preset, aspect ratio, and resolution (for video).</li>
          <li>Choose image/video count and click Create.</li>
          <li>Click the generated content to open full view, then edit or download.</li>
        </ol>
      </Section>

      <Section id="my-files" title="My Files">
        <p>View and manage all your uploaded and generated content. Filter by type (uploads, generated images, videos, edits) and sort by newest first. Use the Details button to see file information, or delete multiple files at once.</p>
      </Section>

      <Section id="editing" title="Image Editing">
        <ol className="list-decimal list-inside space-y-1">
          <li>Click any image to open the editor.</li>
          <li>Add text overlays with your brand font and colors.</li>
          <li>Draw freehand or add shapes using the drawing tools.</li>
          <li>Save to replace the original or download the edited version.</li>
        </ol>
      </Section>

      <Section id="users" title="Users (Admin Only)">
        <ol className="list-decimal list-inside space-y-1">
          <li>Search users by name or email using the search bar.</li>
          <li>Filter users by role (All, Admin, Editor) using the dropdown.</li>
          <li>Change user roles by selecting from the role dropdown—confirmation required.</li>
          <li>Enable or disable user accounts—confirmation required.</li>
          <li>Delete users permanently—confirmation required with warning.</li>
        </ol>
        <p className="mt-2 text-sm text-dark-text-secondary">Note: Only admins can access the Users page. All user management actions require confirmation to prevent accidental changes.</p>
      </Section>

      <Section id="billing" title="Billing">
        <p>View your spending over time, credit usage, and remaining credits. Data is automatically tracked from your GCP project usage.</p>
      </Section>

      <Section id="tips" title="Tips for Best Results">
        <ul className="list-disc list-inside space-y-1">
          <li>Use the Random button for creative prompt ideas, then Improve to refine them.</li>
          <li>Stage images for context—reference them in prompts using <code>@1</code>, <code>@2</code>, etc.</li>
          <li>Try different style presets to achieve specific visual effects.</li>
          <li>For video, choose 720p for faster generation or 1080p for higher quality.</li>
          <li>Save your work frequently and use My Files to organize your content.</li>
        </ul>
      </Section>

      <Section id="contact-support" title="Contact Support">
        <p>
          For questions or feedback, contact the support team:<br />
          <a className="text-blue-400 hover:underline" href="mailto:tanpham@cloud-ace.com">tanpham@cloud-ace.com</a> or{' '}
          <a className="text-blue-400 hover:underline" href="mailto:jaslyn.siow@cloud-ace.com">jaslyn.siow@cloud-ace.com</a>.
        </p>
      </Section>
    </div>
  );
}



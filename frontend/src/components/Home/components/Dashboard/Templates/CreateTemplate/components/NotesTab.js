import React from 'react';
import TemplateNotesTab from '../../../../Unified/UnifiedTextEditor/Preview/components/TemplateNotesTab';

const NotesTab = ({ parsedTemplate, associationType = 'template', currentUser, onNotesChange }) => {
  return (
    <TemplateNotesTab 
      parsedTemplate={parsedTemplate}
      associationType={associationType}
      currentUser={currentUser}
      onNotesChange={onNotesChange}
    />
  );
};

export default NotesTab;

import { useState } from 'react';
import { message } from 'antd';

export const useApprovers = (departments) => {
  const [approvers, setApprovers] = useState([]);

  // Add approver function
  const addApprover = () => {
    // Get already selected departments
    const selectedDepartments = approvers.map(approver => approver.department);
    
    // Check if there are any unselected departments left
    const availableDepartments = departments.filter(
      dept => !selectedDepartments.includes(dept.name)
    );
    
    if (availableDepartments.length === 0) {
      message.warning('All departments have already been assigned as approvers.');
      return;
    }
    
    // Find all existing stages and get the maximum stage number
    const existingStages = approvers.map(a => a.stage);
    const maxStage = existingStages.length > 0 ? Math.max(...existingStages) : 0;
    
    // Default to stage 1 for the first approver, otherwise use the latest stage
    const nextStage = maxStage > 0 ? maxStage : 1;
    
    const newApprover = {
      key: approvers.length,
      department: availableDepartments[0]?.name || '',
      mandatory: false,
      stage: nextStage,
      participants: []
    };
    
    setApprovers([...approvers, newApprover]);
  };

  // Remove approver function
  const removeApprover = (key) => {
    const approverToRemove = approvers.find(a => a.key === key);
    if (!approverToRemove) return;
    
    const removedStage = approverToRemove.stage;
    
    // Remove the approver
    const filteredApprovers = approvers.filter(approver => approver.key !== key);
    
    // Adjust stages for remaining approvers
    const updatedApprovers = filteredApprovers.map(approver => {
      if (approver.stage > removedStage) {
        return { ...approver, stage: approver.stage - 1 };
      }
      return approver;
    });
    
    // Sort by stage
    const sortedApprovers = [...updatedApprovers].sort((a, b) => a.stage - b.stage);
    
    // Update keys to be sequential
    const reindexedApprovers = sortedApprovers.map((approver, index) => ({
      ...approver,
      key: index
    }));
    
    setApprovers(reindexedApprovers);
  };

  const handleApproverChange = (key, field, value) => {
    setApprovers(approvers.map(approver => {
      if (approver.key === key) {
        return { ...approver, [field]: value };
      }
      return approver;
    }));
  };

  const handleApproverDepartmentChange = (key, value) => {
    // Update state
    const updatedApprovers = approvers.map(approver => {
      if (approver.key === key) {
        return { 
          ...approver, 
          department: value,
          participants: [] // Clear participants when department changes
        };
      }
      return approver;
    });
    
    setApprovers(updatedApprovers);
  };

  return {
    approvers,
    setApprovers,
    addApprover,
    removeApprover,
    handleApproverChange,
    handleApproverDepartmentChange
  };
};

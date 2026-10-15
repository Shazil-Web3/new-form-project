import React, { useState, useRef } from 'react';
import { Layout, Menu } from 'antd';
import './Sidebar.css';

const { Sider } = Layout;
const { SubMenu } = Menu;

const Sidebar = ({
  activeTab,
  setActiveTab,
  menuItems,
  user
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef(null);

  // Smooth hover expansion
  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(true);
  };

  // Smooth hover collapse
  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 150);
  };

  // Function to check if user has access to a menu item
  const hasAccess = (item) => {
    const userRole = user?.role?.toLowerCase();
    const isTemplateApprover = user?.template_approver === 'yes';
    
    if (item.adminOnly && userRole !== 'admin') return false;
    if (item.authorOnly && userRole !== 'author') return false;
    if (item.pmOnly && userRole !== 'project manager') return false;
    if (item.adminAuthorOnly && !['admin', 'author'].includes(userRole)) return false;
    if (item.adminPmOnly && !['admin', 'project manager'].includes(userRole)) return false;
    if (item.tempApprover && !isTemplateApprover) return false;
    if (item.excludeMember && userRole === 'member') return false;

    return true;
  };

  // Function to render menu items
  const renderMenuItems = (items) => {
    return items.map(item => {
      if (!hasAccess(item)) return null;
      
      if (item.children) {
        const accessibleChildren = item.children.filter(child => hasAccess(child));
        if (accessibleChildren.length === 0) return null;
        
        return (
          <SubMenu 
            key={item.key} 
            icon={item.icon} 
            title={item.label}
          >
            {accessibleChildren.map(child => (
              <Menu.Item key={child.key} icon={child.icon} style={child.style}>
                {child.label}
              </Menu.Item>
            ))}
          </SubMenu>
        );
      } else {
        return (
          <Menu.Item key={item.key} icon={item.icon}>
            {item.label}
          </Menu.Item>
        );
      }
    }).filter(Boolean);
  };

  return (
    <Sider 
      collapsible 
      collapsed={true}
      width={64}
      collapsedWidth={64}
      theme="light"
      className="clean-hover-sider"
      trigger={null}
    >
      <div 
        className={`clean-overlap-panel ${isHovered ? 'is-expanded' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Menu
          mode="inline"
          selectedKeys={[activeTab]}
          onClick={({ key }) => setActiveTab(key)}
          style={{ borderRight: 0, marginTop: '8px' }}
          inlineCollapsed={!isHovered}
        >
          {renderMenuItems(menuItems)}
        </Menu>
      </div>
    </Sider>
  );
};

export default Sidebar;

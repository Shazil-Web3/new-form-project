// components/Header.jsx
import React from 'react';
import { 
  Layout, 
  Typography, 
  Input, 
  Badge, 
  Dropdown, 
  Menu, 
  Avatar, 
  Button 
} from 'antd';
import { BellOutlined, UserOutlined, LogoutOutlined, SettingOutlined } from '@ant-design/icons';

const { Header } = Layout;
const { Title, Text } = Typography;
const { Search } = Input;

const HeaderComponent = ({
  user,
  localTime,
  notifications,
  handleLogout
}) => {
  // Profile dropdown menu
  const userMenu = (
    <Menu>
      <Menu.Item key="profile" icon={<UserOutlined />}>Profile</Menu.Item>
      <Menu.Item key="settings" icon={<SettingOutlined />}>Settings</Menu.Item>
      <Menu.Divider />
      <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={handleLogout}>
        Logout
      </Menu.Item>
    </Menu>
  );

  // Notifications dropdown menu
  const notificationsMenu = (
    <Menu style={{ width: 300 }}>
      <Menu.Item style={{ fontWeight: 'bold', background: '#f0f0f0' }}>
        Notifications
      </Menu.Item>
      <Menu.Divider />
      {notifications.length > 0 ? (
        notifications.map(notification => (
          <Menu.Item key={notification.id} style={{ whiteSpace: 'normal' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <Badge status={notification.read ? "default" : "processing"} style={{ marginTop: 6, marginRight: 2 }} />
              <div>
                <div>{notification.message}</div>
                <div style={{ fontSize: '12px', color: '#999' }}>{notification.time}</div>
              </div>
            </div>
          </Menu.Item>
        ))
      ) : (
        <Menu.Item disabled>No notifications</Menu.Item>
      )}
      <Menu.Divider />
      <Menu.Item style={{ textAlign: 'center' }}>
        <a>View All Notifications</a>
      </Menu.Item>
    </Menu>
  );

  return (
      <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', color: 'white', position: 'sticky', top: 0, zIndex: 10000, height: '64px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Title level={4} style={{ color: 'white', margin: 0 }}>CustomDocs</Title>
          <Text style={{ color: 'rgba(255, 255, 255, 0.65)', marginLeft: 16 }}>{localTime}</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Search 
            placeholder="Search..." 
            allowClear
            style={{ width: 240, marginRight: 16 }}
            onSearch={value => console.log(value)}
          />
          <Dropdown overlay={notificationsMenu} trigger={['click']} placement="bottomRight">
            <Badge count={notifications.filter(n => !n.read).length} overflowCount={99}>
              <Button type="text" icon={<BellOutlined style={{ color: 'white', fontSize: 20 }} />} style={{ marginRight: 8 }} />
            </Badge>
          </Dropdown>
          <Dropdown overlay={userMenu} trigger={['click']} placement="bottomRight">
            <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} />
              <span style={{ marginLeft: 8, color: 'white' }}>{user?.email}</span>
            </div>
          </Dropdown>
        </div>
      </Header>
  );
};

export default HeaderComponent;
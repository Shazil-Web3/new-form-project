import React, { useState } from 'react';
import { 
  Card, 
  Tabs, 
  Form, 
  Input, 
  Button, 
  Checkbox, 
  Radio, 
  Select, 
  Row, 
  Col,
  Typography,
  Divider,
  Upload,
  Avatar,
  message, Tag
} from 'antd';
import { 
  UserOutlined,
  MailOutlined,
  LockOutlined,
  BellOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
  UploadOutlined
} from '@ant-design/icons';

const { TabPane } = Tabs;
const { Option } = Select;
const { Title, Text } = Typography;

const Settings = ({ user }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [profileImage, setProfileImage] = useState(null);

  const onFinish = (values) => {
    setLoading(true);
    console.log('Received values:', values);
    // Here you would typically make an API call to update settings
    setTimeout(() => {
      setLoading(false);
      message.success('Settings updated successfully');
    }, 1500);
  };

  const beforeUpload = (file) => {
    const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
    if (!isJpgOrPng) {
      message.error('You can only upload JPG/PNG files!');
    }
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      message.error('Image must be smaller than 2MB!');
    }
    return isJpgOrPng && isLt2M;
  };

  const handleUpload = (info) => {
    if (info.file.status === 'done') {
      setProfileImage(URL.createObjectURL(info.file.originFileObj));
      message.success(`${info.file.name} file uploaded successfully`);
    } else if (info.file.status === 'error') {
      message.error(`${info.file.name} file upload failed.`);
    }
  };

  return (
    <Card title="Settings">
      <Tabs defaultActiveKey="account">
        {/* Account Settings Tab */}
        <TabPane tab="Account" key="account">
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              email: user?.email,
              name: user?.name,
              timezone: 'America/New_York'
            }}
            onFinish={onFinish}
          >
            <Row gutter={24}>
              <Col xs={24} md={8} style={{ textAlign: 'center' }}>
                <Avatar 
                  size={128} 
                  src={profileImage || user?.avatar} 
                  icon={<UserOutlined />}
                  style={{ marginBottom: 16 }}
                />
                <Upload
                  name="avatar"
                  showUploadList={false}
                  beforeUpload={beforeUpload}
                  onChange={handleUpload}
                  accept="image/*"
                >
                  <Button icon={<UploadOutlined />}>Change Avatar</Button>
                </Upload>
                <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                  JPG or PNG, max 2MB
                </Text>
              </Col>
              
              <Col xs={24} md={16}>
                <Title level={5} style={{ marginBottom: 24 }}>Profile Information</Title>
                
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="name"
                      label="Full Name"
                      rules={[{ required: true, message: 'Please input your name' }]}
                    >
                      <Input prefix={<UserOutlined />} placeholder="Your full name" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="email"
                      label="Email"
                      rules={[
                        { required: true, message: 'Please input your email' },
                        { type: 'email', message: 'Please enter a valid email' }
                      ]}
                    >
                      <Input prefix={<MailOutlined />} placeholder="Your email" />
                    </Form.Item>
                  </Col>
                </Row>

                <Divider />

                <Title level={5} style={{ marginBottom: 24 }}>Change Password</Title>
                
                <Form.Item
                  name="currentPassword"
                  label="Current Password"
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="Current password"
                    iconRender={visible => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                  />
                </Form.Item>

                <Form.Item
                  name="newPassword"
                  label="New Password"
                  rules={[
                    { min: 6, message: 'Password must be at least 6 characters' }
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="New password"
                    iconRender={visible => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                  />
                </Form.Item>

                <Form.Item
                  name="confirmPassword"
                  label="Confirm Password"
                  dependencies={['newPassword']}
                  rules={[
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('newPassword') === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject('The two passwords do not match!');
                      },
                    }),
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="Confirm new password"
                    iconRender={visible => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                  />
                </Form.Item>

                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={loading}>
                    Save Changes
                  </Button>
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </TabPane>

        {/* Notifications Tab */}
        <TabPane tab="Notifications" key="notifications">
          <Form
            layout="vertical"
            initialValues={{
              emailNotifications: true,
              docUpdates: true,
              taskAssignments: true,
              comments: true,
              mentions: true,
              pushNotifications: false
            }}
            onFinish={onFinish}
          >
            <Title level={5} style={{ marginBottom: 24 }}>Email Notifications</Title>
            
            <Form.Item name="emailNotifications" valuePropName="checked">
              <Checkbox>Enable email notifications</Checkbox>
            </Form.Item>

            <Form.Item name="docUpdates" valuePropName="checked">
              <Checkbox>Document updates</Checkbox>
            </Form.Item>

            <Form.Item name="taskAssignments" valuePropName="checked">
              <Checkbox>Task assignments</Checkbox>
            </Form.Item>

            <Form.Item name="comments" valuePropName="checked">
              <Checkbox>Comments on my documents</Checkbox>
            </Form.Item>

            <Form.Item name="mentions" valuePropName="checked">
              <Checkbox>Mentions (@username)</Checkbox>
            </Form.Item>

            <Divider />

            <Title level={5} style={{ marginBottom: 24 }}>Push Notifications</Title>
            
            <Form.Item name="pushNotifications" valuePropName="checked">
              <Checkbox>Enable push notifications</Checkbox>
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading}>
                Save Preferences
              </Button>
            </Form.Item>
          </Form>
        </TabPane>

        {/* Preferences Tab */}
        <TabPane tab="Preferences" key="preferences">
          <Form
            layout="vertical"
            initialValues={{
              theme: 'light',
              dateFormat: 'MM/DD/YYYY',
              timezone: 'America/New_York',
              language: 'en'
            }}
            onFinish={onFinish}
          >
            <Title level={5} style={{ marginBottom: 24 }}>Display</Title>
            
            <Form.Item name="theme" label="Theme">
              <Radio.Group>
                <Radio value="light">Light</Radio>
                <Radio value="dark">Dark</Radio>
                <Radio value="system">System Default</Radio>
              </Radio.Group>
            </Form.Item>

            <Divider />

            <Title level={5} style={{ marginBottom: 24 }}>Date & Time</Title>
            
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="dateFormat" label="Date Format">
                  <Select>
                    <Option value="MM/DD/YYYY">MM/DD/YYYY</Option>
                    <Option value="DD/MM/YYYY">DD/MM/YYYY</Option>
                    <Option value="YYYY-MM-DD">YYYY-MM-DD</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="timezone" label="Timezone">
                  <Select showSearch>
                    <Option value="America/New_York">Eastern Time (ET)</Option>
                    <Option value="America/Chicago">Central Time (CT)</Option>
                    <Option value="America/Denver">Mountain Time (MT)</Option>
                    <Option value="America/Los_Angeles">Pacific Time (PT)</Option>
                    <Option value="UTC">UTC</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Divider />

            <Title level={5} style={{ marginBottom: 24 }}>Language</Title>
            
            <Form.Item name="language" label="Interface Language">
              <Select>
                <Option value="en">English</Option>
                <Option value="es">Spanish</Option>
                <Option value="fr">French</Option>
                <Option value="de">German</Option>
                <Option value="ja">Japanese</Option>
              </Select>
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading}>
                Save Preferences
              </Button>
            </Form.Item>
          </Form>
        </TabPane>

        {/* Security Tab */}
        <TabPane tab="Security" key="security">
          <Title level={5} style={{ marginBottom: 24 }}>Login Activity</Title>
          <Card style={{ marginBottom: 24 }}>
            <p>Last login: March 28, 2025 at 14:30 (ET) from New York, NY</p>
            <p>Device: MacBook Pro (Safari 16.0)</p>
            <p>IP Address: 192.168.1.1</p>
          </Card>

          <Title level={5} style={{ marginBottom: 24 }}>Active Sessions</Title>
          <Card style={{ marginBottom: 24 }}>
            <p>Current session (this device)</p>
            <Button type="link" danger>Log out from all other devices</Button>
          </Card>

          <Title level={5} style={{ marginBottom: 24 }}>Two-Factor Authentication</Title>
          <Card>
            <p>Status: <Tag color="red">Disabled</Tag></p>
            <Button type="primary">Enable 2FA</Button>
            <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
              Add an extra layer of security to your account
            </Text>
          </Card>
        </TabPane>
      </Tabs>
    </Card>
  );
};

export default Settings;
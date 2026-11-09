import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import apiClient from '../api/apiClient';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  message, 
  Typography, 
  Divider,
  Space
} from 'antd';
import { 
  MailOutlined, 
  LockOutlined, 
  ShopOutlined 
} from '@ant-design/icons';
import { useAuth } from '../utils/authService';

const { Title, Text } = Typography;

const AuthCard = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuthTokens, setUserData, isAuthenticated } = useAuth();
  
  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Get redirect path from location state (if available)
  const from = location.state?.from?.pathname || '/dashboard';

const handleLogin = async (values) => {
  try {
    setLoading(true);
    const response = await apiClient.post('/api/users/login', {
      email: values.email,
      password: values.password
    });

    setAuthTokens({
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken
    });
    
    setUserData(response.data.user);
    navigate(from, { replace: true });
    message.success('Login successful!');
  } catch (error) {
    console.error('Login error:', error);
    const errorMessage = error.response?.data?.message || 
                        error.response?.data?.error || 
                        error.message || 
                        'Login failed';
    message.error(errorMessage);
  } finally {
    setLoading(false);
  }
};
  const handleRegister = async (values) => {
    try {
      setLoading(true);
      // First create the organization
      const orgResponse = await apiClient.post('/api/organization/register', {
        name: values.organization,
        settings: {
          general: {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            default_language: 'en'
          }
        }
      });

      // Then register the admin user
      const userResponse = await apiClient.post('/api/users/register', {
        orgId: orgResponse.data.id,
        email: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
        role: 'admin'
      });

      // Automatically log in the new user
      await handleLogin({
        email: values.email,
        password: values.password
      });
    } catch (error) {
      console.error('Registration error:', error);
      message.error(error.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    if (isLogin) {
      await handleLogin(values);
    } else {
      await handleRegister(values);
    }
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    form.resetFields();
  };

  return (
    <Card 
      style={{ 
        width: 400, 
        margin: '100px auto', 
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        borderRadius: 8
      }}
      bordered={false}
    >
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={3}>
          {isLogin ? 'Welcome Back' : 'Create Organization'}
        </Title>
        <Text type="secondary">
          {isLogin ? 'Sign in to continue' : 'Register your organization and admin account'}
        </Text>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
      >
        {!isLogin && (
          <>
            <Form.Item
              name="organization"
              label="Organization Name"
              rules={[{ required: true, message: 'Please input your organization name!' }]}
            >
              <Input 
                prefix={<ShopOutlined />} 
                placeholder="Company or organization name" 
              />
            </Form.Item>

            <Space>
              <Form.Item
                name="firstName"
                label="First Name"
                rules={[{ required: true, message: 'Please input your first name!' }]}
              >
                <Input placeholder="First name" />
              </Form.Item>

              <Form.Item
                name="lastName"
                label="Last Name"
                rules={[{ required: true, message: 'Please input your last name!' }]}
              >
                <Input placeholder="Last name" />
              </Form.Item>
            </Space>
          </>
        )}

        <Form.Item
          name="email"
          label="Email"
          rules={[
            { 
              required: true, 
              message: 'Please input your email!' 
            },
            { 
              type: 'email', 
              message: 'Please enter a valid email!' 
            }
          ]}
        >
          <Input 
            prefix={<MailOutlined />} 
            placeholder="Email address" 
          />
        </Form.Item>

        <Form.Item
          name="password"
          label="Password"
          rules={[
            { 
              required: true, 
              message: 'Please input your password!' 
            },
            { 
              min: 8, 
              message: 'Password must be at least 8 characters!' 
            }
          ]}
        >
          <Input.Password 
            prefix={<LockOutlined />} 
            placeholder="Password" 
          />
        </Form.Item>

        {!isLogin && (
          <Form.Item
            name="confirmPassword"
            label="Confirm Password"
            dependencies={['password']}
            rules={[
              { 
                required: true, 
                message: 'Please confirm your password!' 
              },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('The two passwords do not match!'));
                },
              }),
            ]}
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="Confirm password" 
            />
          </Form.Item>
        )}

        <Form.Item>
          <Button 
            type="primary" 
            htmlType="submit" 
            block
            loading={loading}
          >
            {isLogin ? 'Sign In' : 'Create Organization'}
          </Button>
        </Form.Item>
      </Form>

      <Divider plain>
        <Text type="secondary">
          {isLogin ? 'Need to create an organization?' : 'Already have an account?'}
        </Text>
      </Divider>

      <Button 
        type="link" 
        block
        onClick={toggleAuthMode}
      >
        {isLogin ? 'Register New Organization' : 'Sign In Instead'}
      </Button>
    </Card>
  );
};

export default AuthCard;
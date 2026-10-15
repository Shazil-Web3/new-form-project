import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  message, 
  Typography, 
  Divider,
  Spin,
  Result
} from 'antd';
import { 
  MailOutlined, 
  LockOutlined, 
  UserOutlined,
  TeamOutlined,
  BankOutlined,
  LoadingOutlined,
  EnvironmentOutlined
} from '@ant-design/icons';
import { useAuth } from '../utils/authService';

const { Title, Text } = Typography;

const InvitedUserRegistration = () => {
  const { token } = useParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [inviteData, setInviteData] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { setAuthTokens, setUserData, isAuthenticated } = useAuth();
  
  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);
  
  // Verify the invitation token
  useEffect(() => {
    const verifyInvitation = async () => {
      try {
        const response = await axios.get(`/api/invitations/verify/${token}`);
        setInviteData(response.data);
        
        // Pre-fill the email field
        form.setFieldsValue({
          email: response.data.email
        });
      } catch (err) {
        console.error('Error verifying invitation:', err);
        setError(err.response?.data?.error || 'Invalid or expired invitation');
      } finally {
        setVerifying(false);
      }
    };
    
    if (token) {
      verifyInvitation();
    }
  }, [token, form]);
  
  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      
      // Submit registration with token and form values
      const response = await axios.post('/api/invitations/register', {
        token,
        firstName: values.firstName,
        lastName: values.lastName,
        password: values.password
      });
      
      // Set authentication tokens and user data
      setAuthTokens({
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken
      });
      
      setUserData(response.data.user);
      
      message.success('Registration successful!');
      navigate('/dashboard');
    } catch (err) {
      console.error('Registration error:', err);
      message.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };
  
  // Show loading state
  if (verifying) {
    return (
      <Card 
        style={{ 
          width: 400, 
          margin: '100px auto', 
          textAlign: 'center',
          padding: '50px 0'
        }}
      >
        <Spin 
          indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} 
          tip="Verifying invitation..." 
        />
      </Card>
    );
  }
  
  // Show error if invalid invitation
  if (error) {
    return (
      <Result
        status="error"
        title="Invalid Invitation"
        subTitle={error}
        extra={[
          <Button type="primary" key="login" onClick={() => navigate('/login')}>
            Go to Login
          </Button>
        ]}
        style={{ margin: '100px auto', maxWidth: 500 }}
      />
    );
  }
  
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
        <Title level={3}>Complete Your Registration</Title>
        <Text type="secondary">
          You've been invited to join an organization
        </Text>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
      >
        <Form.Item
          name="email"
          label="Email"
        >
          <Input 
            prefix={<MailOutlined />} 
            disabled 
            style={{ backgroundColor: '#f5f5f5' }}
          />
        </Form.Item>
        
        {inviteData?.role && (
          <Form.Item
            label="Role"
          >
            <Input 
              prefix={<TeamOutlined />}
              value={inviteData.role}
              disabled
              style={{ backgroundColor: '#f5f5f5' }}
            />
          </Form.Item>
        )}
        
        {inviteData?.department && (
          <Form.Item
            label="Department"
          >
            <Input 
              prefix={<BankOutlined />}
              value={inviteData.department}
              disabled
              style={{ backgroundColor: '#f5f5f5' }}
            />
          </Form.Item>
        )}

        {inviteData?.site && (
          <Form.Item
            label="Site"
          >
            <Input 
              prefix={<EnvironmentOutlined />}
              value={inviteData.site}
              disabled
              style={{ backgroundColor: '#f5f5f5' }}
            />
          </Form.Item>
        )}

        <Form.Item
          name="firstName"
          label="First Name"
          rules={[{ required: true, message: 'Please input your first name!' }]}
        >
          <Input 
            prefix={<UserOutlined />}
            placeholder="First name" 
          />
        </Form.Item>

        <Form.Item
          name="lastName"
          label="Last Name"
          rules={[{ required: true, message: 'Please input your last name!' }]}
        >
          <Input 
            prefix={<UserOutlined />}
            placeholder="Last name" 
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

        <Form.Item>
          <Button 
            type="primary" 
            htmlType="submit" 
            block
            loading={loading}
          >
            Complete Registration
          </Button>
        </Form.Item>
      </Form>

      <Divider plain>
        <Text type="secondary">
          Already have an account?
        </Text>
      </Divider>

      <Button 
        type="link" 
        block
        onClick={() => navigate('/login')}
      >
        Sign In Instead
      </Button>
    </Card>
  );
};

export default InvitedUserRegistration;
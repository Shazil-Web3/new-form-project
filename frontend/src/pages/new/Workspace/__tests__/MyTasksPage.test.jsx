import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MyTasksPage from '../MyTasksPage';
import { useAuth } from '../../../../utils/authService';
import apiClient from '../../../../api/apiClient';

jest.mock('../../../../utils/authService', () => ({
  useAuth: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock('../../../../api/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
  },
}));

describe('MyTasksPage create task modal', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({
      user: { id: 42, first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' },
    });

    apiClient.get.mockImplementation((url) => {
      if (url === '/api/tasks/my-tasks' || url === '/api/tasks/sent') {
        return Promise.resolve({ data: [] });
      }
      if (url === '/api/users') {
        return Promise.resolve({ data: [
          { id: 42, first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' },
          { id: 7, first_name: 'Grace', last_name: 'Hopper', email: 'grace@example.com' },
        ] });
      }
      if (url === '/api/documents') {
        return Promise.resolve({ data: [{ document_id: 'doc-1', title: 'Quarterly Plan' }] });
      }
      if (url.includes('/comments')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    apiClient.post.mockResolvedValue({ data: {} });
  });

  it('shows user and document dropdowns in the create task modal', async () => {
    render(<MyTasksPage />);

    fireEvent.click(screen.getByRole('button', { name: /new task/i }));

    expect(await screen.findByLabelText(/assign to/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/related document/i)).toBeInTheDocument();
  });

  it('filters the task list by search text across title, description, and sender name', async () => {
    apiClient.get.mockImplementation((url) => {
      if (url === '/api/tasks/my-tasks' || url === '/api/tasks/sent') {
        return Promise.resolve({
          data: [
            {
              id: 1,
              title: 'Quarterly report review',
              description: 'Gather feedback from the finance team.',
              status: 'not_started',
              created_by_first_name: 'Ada',
              created_by_last_name: 'Lovelace',
            },
            {
              id: 2,
              title: 'Onboarding checklist',
              description: 'Prepare account access for the new teammate.',
              status: 'in_progress',
              created_by_first_name: 'Grace',
              created_by_last_name: 'Hopper',
            },
          ],
        });
      }
      if (url === '/api/users') {
        return Promise.resolve({ data: [{ id: 42, first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' }] });
      }
      if (url === '/api/documents') {
        return Promise.resolve({ data: [{ document_id: 'doc-1', title: 'Quarterly Plan' }] });
      }
      if (url.includes('/comments')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    render(<MyTasksPage />);

    const searchInput = await screen.findByPlaceholderText(/search tasks/i);
    fireEvent.change(searchInput, { target: { value: 'grace' } });

    expect(await screen.findByText(/onboarding checklist/i)).toBeInTheDocument();
    expect(screen.queryByText(/quarterly report review/i)).not.toBeInTheDocument();
  });
});

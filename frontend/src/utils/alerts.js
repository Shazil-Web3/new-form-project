// utils/alerts.js
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

/**
 * Success Alert
 * @param {string} title - Alert title
 * @param {string} text - Alert content text
 * @param {object} options - Additional SweetAlert2 options
 */
export const successAlert = (title = 'Success!', text = 'Operation completed successfully', options = {}) => {
  return MySwal.fire({
    title,
    text,
    icon: 'success',
    confirmButtonColor: '#3085d6',
    ...options
  });
};

/**
 * Error Alert
 * @param {string} title - Alert title
 * @param {string} text - Alert content text
 * @param {object} options - Additional SweetAlert2 options
 */
export const errorAlert = (title = 'Error!', text = 'Something went wrong', options = {}) => {
  return MySwal.fire({
    title,
    text,
    icon: 'error',
    confirmButtonColor: '#d33',
    ...options
  });
};

/**
 * Warning Alert
 * @param {string} title - Alert title
 * @param {string} text - Alert content text
 * @param {object} options - Additional SweetAlert2 options
 */
export const warningAlert = (title = 'Warning!', text = 'Are you sure you want to continue?', options = {}) => {
  return MySwal.fire({
    title,
    text,
    icon: 'warning',
    confirmButtonColor: '#ffc107',
    ...options
  });
};

/**
 * Confirmation Dialog
 * @param {string} title - Alert title
 * @param {string} text - Alert content text
 * @param {string} confirmText - Confirm button text
 * @param {string} cancelText - Cancel button text
 * @param {object} options - Additional SweetAlert2 options
 */
export const confirmAlert = (
  title = 'Are you sure?',
  text = "You won't be able to revert this!",
  confirmText = 'Yes, proceed',
  cancelText = 'Cancel',
  options = {}
) => {
  return MySwal.fire({
    title,
    text,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    ...options
  });
};

/**
 * Toast Notification
 * @param {string} title - Toast title
 * @param {string} icon - 'success', 'error', 'warning', 'info', 'question'
 * @param {object} options - Additional SweetAlert2 options
 */
export const toastAlert = (title, icon = 'success', options = {}) => {
  return MySwal.fire({
    title,
    icon,
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    ...options
  });
};

/**
 * Form Input Alert
 * @param {string} title - Alert title
 * @param {string} inputType - Input type (text, email, password, etc.)
 * @param {string} inputPlaceholder - Input placeholder text
 * @param {object} options - Additional SweetAlert2 options
 */
export const inputAlert = (
  title = 'Enter your information',
  inputType = 'text',
  inputPlaceholder = 'Type here...',
  options = {}
) => {
  return MySwal.fire({
    title,
    input: inputType,
    inputPlaceholder,
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    ...options
  });
};

export default {
  successAlert,
  errorAlert,
  warningAlert,
  confirmAlert,
  toastAlert,
  inputAlert
};
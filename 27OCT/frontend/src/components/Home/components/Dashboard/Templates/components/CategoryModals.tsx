import React from 'react';
import { Modal, Form, Input } from 'antd';
import { getCategoryNameById } from '../utils/templateListUtils';

export const CategoryModals = ({
  addCategoryVisible,
  setAddCategoryVisible,
  submitAddCategory,
  addCategoryForm,
  currentCategory,
  orgCategories,
  editCategoryVisible,
  setEditCategoryVisible,
  submitEditCategory,
  editCategoryForm
}) => {
  return (
    <>
      {/* Add Category Modal */}
      <Modal
        title="Add New Category"
        open={addCategoryVisible}
        onCancel={() => setAddCategoryVisible(false)}
        onOk={submitAddCategory}
      >
        <Form
          form={addCategoryForm}
          layout="vertical"
        >
          <Form.Item
            name="categoryName"
            label="Category Name"
            rules={[{ required: true, message: 'Please enter a category name' }]}
          >
            <Input placeholder="Enter category name" />
          </Form.Item>
          
          <Form.Item
            name="categoryPrefix"
            label="Category Prefix"
            rules={[{ required: true, message: 'Please enter a category prefix' }]}
          >
            <Input placeholder="Enter new category prefix" />
          </Form.Item>

          {/* Show current parent folder information */}
          <Form.Item label="Parent Folder">
            <Input 
              value={currentCategory.id === 0 ? "Root Level" : getCategoryNameById(currentCategory.id, orgCategories)} 
              disabled 
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Category Modal */}
      <Modal
        title="Edit Category"
        open={editCategoryVisible}
        onCancel={() => setEditCategoryVisible(false)}
        onOk={submitEditCategory}
      >
        <Form
          form={editCategoryForm}
          layout="vertical"
        >
          <Form.Item
            name="categoryName"
            label="Category Name"
            rules={[{ required: true, message: 'Please enter a category name' }]}
          >
            <Input placeholder="Enter new category name" />
          </Form.Item>

          <Form.Item
            name="categoryPrefix"
            label="Category Prefix"
            rules={[{ required: true, message: 'Please enter a category prefix' }]}
          >
            <Input placeholder="Enter new category prefix" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default CategoryModals;

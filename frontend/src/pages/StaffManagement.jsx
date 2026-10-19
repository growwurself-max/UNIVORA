import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Edit2,
  UserPlus,
  Shield,
  Briefcase,
  X,
  Loader2,
  Filter,
} from 'lucide-react';
import { staffAPI } from '../services/api';

const StaffManagement = () => {
  const [staff, setStaff] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentStaff, setCurrentStaff] = useState(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    role_id: '',
  });
  const [assignmentData, setAssignmentData] = useState({
    assignment_type: 'general',
    assignment_id: '',
  });

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await staffAPI.list({ search, page: 1, limit: 100 });
      setStaff(data.data.items || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load staff records.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  const fetchRoles = useCallback(async () => {
    try {
      const { data } = await staffAPI.roles();
      setRoles(data.data.roles || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load assignable staff roles.');
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchStaff(), fetchRoles()]);
  }, [fetchRoles, fetchStaff]);

  const handleOpenModal = (member = null) => {
    if (member) {
      setIsEditing(true);
      setCurrentStaff(member);
      setFormData({
        full_name: member.full_name,
        email: member.email,
        role_id: member.role_id,
      });
    } else {
      setIsEditing(false);
      setCurrentStaff(null);
      setFormData({
        full_name: '',
        email: '',
        role_id: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await staffAPI.update(currentStaff.id, {
          full_name: formData.full_name,
          role_id: formData.role_id,
        });
      } else {
        await staffAPI.create(formData);
      }
      setIsModalOpen(false);
      await fetchStaff();
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving staff member');
    }
  };

  const handleAssignResponsibility = async (profileId, type, id) => {
    try {
      await staffAPI.assign({
        profile_id: profileId,
        assignment_type: type,
        assignment_id: type === 'general' ? null : id,
      });
      await fetchStaff();
    } catch (err) {
      alert(err.response?.data?.message || 'Error assigning responsibility');
    }
  };

  const handleRemoveAssignment = async (assignmentId) => {
    try {
      await staffAPI.removeAssignment(assignmentId);
      await fetchStaff();
    } catch (err) {
      alert(err.response?.data?.message || 'Error removing responsibility');
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
          <p className="text-sm text-gray-500">Manage institution personnel and their responsibilities</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          Add Staff Member
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search staff by name or email..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && fetchStaff()}
          />
        </div>
        <button
          onClick={fetchStaff}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
        >
          <Filter className="w-4 h-4" />
          Filter
        </button>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left border-collapse">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Staff Member</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Responsibilities</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan="4" className="px-6 py-10 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                    <span className="text-sm text-gray-500">Loading staff records...</span>
                  </div>
                </td>
              </tr>
            ) : staff.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-6 py-10 text-center text-gray-500">
                  No staff members found.
                </td>
              </tr>
            ) : (
              staff.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">{member.full_name}</span>
                      <span className="text-xs text-gray-500">{member.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Shield className="w-3 h-3 text-gray-400" />
                      <span className="text-sm text-gray-700">{member.roles?.name || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {member.assignments?.map((asgn) => (
                        <span key={asgn.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-medium border border-blue-100">
                          {asgn.assignment_type}
                          <button
                            onClick={() => handleRemoveAssignment(asgn.id)}
                            className="hover:text-red-500 ml-1"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      {(!member.assignments || member.assignments.length === 0) && (
                        <span className="text-xs text-gray-400 italic">No assignments</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleOpenModal(member)}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">
                {isEditing ? 'Edit Staff Member' : 'Add New Staff Member'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-gray-200 rounded-md">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Full Name</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Email Address</label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    disabled={isEditing}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Role</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                  value={formData.role_id}
                  onChange={(e) => setFormData({...formData, role_id: e.target.value})}
                  required
                >
                  <option value="">Select a role...</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-1 italic">Roles are derived from institutional rank guidelines.</p>
              </div>

              {isEditing && (
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-4">
                  <div className="flex items-center gap-2 text-blue-800 font-semibold text-sm">
                    <Briefcase className="w-4 h-4" />
                    Manage Responsibilities
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <select
                      className="px-2 py-1.5 text-xs border border-blue-200 rounded-md bg-white"
                      value={assignmentData.assignment_type}
                      onChange={(e) => setAssignmentData({...assignmentData, assignment_type: e.target.value})}
                    >
                      <option value="general">General</option>
                      <option value="department">Department</option>
                      <option value="class">Class</option>
                      <option value="subject">Subject</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Entity ID"
                      className="px-2 py-1.5 text-xs border border-blue-200 rounded-md"
                      value={assignmentData.assignment_id}
                      onChange={(e) => setAssignmentData({...assignmentData, assignment_id: e.target.value})}
                      disabled={assignmentData.assignment_type === 'general'}
                    />
                    <button
                      type="button"
                      onClick={() => handleAssignResponsibility(currentStaff.id, assignmentData.assignment_type, assignmentData.assignment_id)}
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Assign
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
                >
                  {isEditing ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;

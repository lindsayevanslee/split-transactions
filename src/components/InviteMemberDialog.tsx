import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Tabs,
  Tab,
  Box,
  Typography,
  IconButton,
  Alert,
  CircularProgress,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Group, Member } from '../types';
import { createInvitation } from '../services/invitations';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

interface InviteMemberDialogProps {
  open: boolean;
  onClose: () => void;
  group: Group;
  onUpdateGroup: (updatedGroup: Group) => void;
  userId: string;
}

export const InviteMemberDialog: React.FC<InviteMemberDialogProps> = ({
  open,
  onClose,
  group,
  onUpdateGroup,
  userId,
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [memberName, setMemberName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setError(null);
    setInviteLink(null);
  };

  const handleClose = () => {
    setMemberName('');
    setTabValue(0);
    setError(null);
    setInviteLink(null);
    setLoading(false);
    onClose();
  };

  // Add a placeholder member (no invite link)
  const handleAddPlaceholder = async () => {
    if (!memberName.trim()) return;

    const newMember: Member = {
      id: crypto.randomUUID(),
      name: memberName.trim(),
      balance: 0,
      status: 'placeholder',
    };

    const updatedGroup: Group = {
      ...group,
      members: [...group.members, newMember],
    };

    onUpdateGroup(updatedGroup);
    handleClose();
  };

  // Add member and generate invite link
  const handleAddWithInvite = async () => {
    if (!memberName.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const memberId = crypto.randomUUID();
      const newMember: Member = {
        id: memberId,
        name: memberName.trim(),
        balance: 0,
        status: 'invited',
      };

      // First update the group with the new member
      const updatedGroup: Group = {
        ...group,
        members: [...group.members, newMember],
      };
      onUpdateGroup(updatedGroup);

      // Create the invitation
      const { inviteLink: link } = await createInvitation(
        group.id,
        group.name,
        memberId,
        userId
      );

      setInviteLink(link);
      setMemberName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (inviteLink) {
      await navigator.clipboard.writeText(inviteLink);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Member</DialogTitle>
      <DialogContent>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Add Placeholder" />
          <Tab label="Add & Invite" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add a member by name only. You can generate an invite link later.
          </Typography>
          <TextField
            fullWidth
            label="Member Name"
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            disabled={loading}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {!inviteLink ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Add a member and generate an invite link they can use to link their account.
              </Typography>
              <TextField
                fullWidth
                label="Member Name"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                disabled={loading}
              />
            </>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Alert severity="success">
                Invite link created! Share this link with the member.
              </Alert>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TextField
                  fullWidth
                  value={inviteLink}
                  InputProps={{ readOnly: true }}
                  size="small"
                />
                <IconButton onClick={handleCopyLink} color="primary">
                  <ContentCopyIcon />
                </IconButton>
              </Box>
              <Typography variant="body2" color="text.secondary">
                The link expires in 7 days.
              </Typography>
            </Box>
          )}
        </TabPanel>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>
          {inviteLink ? 'Done' : 'Cancel'}
        </Button>
        {!inviteLink && (
          <Button
            onClick={tabValue === 0 ? handleAddPlaceholder : handleAddWithInvite}
            variant="contained"
            disabled={!memberName.trim() || loading}
          >
            {loading ? <CircularProgress size={24} /> : tabValue === 0 ? 'Add Member' : 'Add & Create Link'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default InviteMemberDialog;

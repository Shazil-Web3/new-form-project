import React from 'react';
import { 
  Card, 
  Calendar, 
  Badge, 
  Typography,
  Button,
  Space,
  List,
  Divider
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import moment from 'moment';

const { Text } = Typography;

const CalendarTab = ({ calendarEvents, handleCreateEvent }) => {
  // Helper function to process events for calendar display
  const processEvents = (events) => {
    return events.map(event => ({
      ...event,
      date: moment(event.start).format('YYYY-MM-DD'),
      time: event.allDay ? 'All Day' : moment(event.start).format('h:mm A')
    }));
  };

  // Format events for calendar display
  const formattedEvents = processEvents(calendarEvents);

  // Calendar date cell renderer
  const dateCellRender = (value) => {
    const formattedDate = value.format('YYYY-MM-DD');
    const dayEvents = formattedEvents.filter(event => event.date === formattedDate);
    
    return (
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {dayEvents.map(event => (
          <li key={event.id} style={{ marginBottom: 2 }}>
            <Badge 
              color={event.type === 'meeting' ? 'blue' : 'green'} 
              text={
                <Text ellipsis style={{ fontSize: 12 }}>
                  {event.time} - {event.title}
                </Text>
              } 
            />
          </li>
        ))}
      </ul>
    );
  };

  // Get upcoming events (next 7 days)
  const upcomingEvents = formattedEvents
    .filter(event => moment(event.date).isSameOrAfter(moment(), 'day'))
    .sort((a, b) => moment(a.date) - moment(b.date))
    .slice(0, 5);

  return (
    <Card
      title="Calendar"
      extra={
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={handleCreateEvent}
        >
          New Event
        </Button>
      }
    >
      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ flex: 3 }}>
          <Calendar 
            dateCellRender={dateCellRender}
            headerRender={({ value, onChange }) => (
              <div style={{ padding: 8, display: 'flex', justifyContent: 'space-between' }}>
                <Space>
                  <Button onClick={() => onChange(value.clone().subtract(1, 'month'))}>
                    Previous
                  </Button>
                  <Text strong>{value.format('MMMM YYYY')}</Text>
                  <Button onClick={() => onChange(value.clone().add(1, 'month'))}>
                    Next
                  </Button>
                </Space>
                <Button onClick={() => onChange(moment())}>
                  Today
                </Button>
              </div>
            )}
          />
        </div>

        <div style={{ flex: 1 }}>
          <Card title="Upcoming Events" bordered={false}>
            {upcomingEvents.length > 0 ? (
              <List
                dataSource={upcomingEvents}
                renderItem={item => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Text strong ellipsis>
                          {item.title}
                        </Text>
                      }
                      description={
                        <Space direction="vertical" size={0}>
                          <Text type="secondary">
                            {moment(item.date).format('ddd, MMM D')}
                          </Text>
                          <Text type="secondary">
                            {item.time}
                          </Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Text type="secondary">No upcoming events</Text>
            )}
            <Divider />
            <Button type="link" block>
              View All Events
            </Button>
          </Card>
        </div>
      </div>
    </Card>
  );
};

export default CalendarTab;
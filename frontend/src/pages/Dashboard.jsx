import EventList from "../components/EventList";

const Dashboard = ({ events, isLoading, onSelectEvent, onRefresh }) => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <EventList
        events={events}
        isLoading={isLoading}
        onSelectEvent={onSelectEvent}
        onRefresh={onRefresh}
      />
    </div>
  );
};

export default Dashboard;
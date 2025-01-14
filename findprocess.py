import psutil

def find_process_by_port(port):
    for proc in psutil.process_iter(['pid', 'name']):
        try:
            # Use net_connections() instead of connections()
            all_connections = psutil.net_connections()
            proc_connections = [conn for conn in all_connections if conn.pid == proc.pid]

            for conn in proc_connections:
                if conn.status == psutil.CONN_LISTEN and conn.laddr and conn.laddr.port == port:
                    print(f"Found process using port {port}:")
                    print(f"  PID: {proc.pid}")
                    print(f"  Name: {proc.name()}")
                    return proc.pid
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    print(f"No process found using port {port}.")
    return None

if __name__ == "__main__":
    port_to_check = 5000
    pid = find_process_by_port(port_to_check)

    if pid:
        try:
            process = psutil.Process(pid)
            process.terminate()
            print(f"Process with PID {pid} terminated.")
        except psutil.NoSuchProcess:
            print(f"Process with PID {pid} no longer exists.")
        except psutil.AccessDenied:
            print(f"Could not terminate process with PID {pid}. Access denied.")
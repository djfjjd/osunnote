import { useMemo, useState } from "react";
import { Check, Circle, ListTodo, Plus, Trash2 } from "lucide-react";
import { makeId, type TodoItem } from "@osunnote/domain";

interface TodoPageProps {
  todos: TodoItem[];
  onChange: (todos: TodoItem[]) => void;
}

type Filter = "all" | "open" | "done";

export function TodoPage({ todos, onChange }: TodoPageProps) {
  const [title, setTitle] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const visible = useMemo(() => todos.filter((todo) => filter === "all" || (filter === "done" ? todo.completed : !todo.completed)), [filter, todos]);
  const remaining = todos.filter((todo) => !todo.completed).length;

  const addTodo = () => {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    const now = Date.now();
    onChange([{ id: makeId(), title: nextTitle, completed: false, createdAt: now, updatedAt: now }, ...todos]);
    setTitle("");
  };

  return <section className="todo-page">
    <header><div><h1>To Do List</h1></div><strong>{remaining}<small>개 남음</small></strong></header>
    <div className="todo-composer"><Plus size={18} /><input value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addTodo(); }} placeholder="새 할 일을 입력하세요" aria-label="새 할 일" /><button type="button" onClick={addTodo} disabled={!title.trim()}>추가</button></div>
    <nav className="todo-filters" aria-label="할 일 필터"><button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>전체 {todos.length}</button><button type="button" className={filter === "open" ? "active" : ""} onClick={() => setFilter("open")}>진행 중 {remaining}</button><button type="button" className={filter === "done" ? "active" : ""} onClick={() => setFilter("done")}>완료 {todos.length - remaining}</button></nav>
    <div className="todo-list">{visible.map((todo) => <article className={todo.completed ? "completed" : ""} key={todo.id}><button type="button" className="todo-toggle" onClick={() => onChange(todos.map((item) => item.id === todo.id ? { ...item, completed: !item.completed, updatedAt: Date.now() } : item))} aria-label={todo.completed ? `${todo.title} 미완료로 변경` : `${todo.title} 완료`} >{todo.completed ? <Check size={15} /> : <Circle size={15} />}</button><span>{todo.title}</span><time>{new Date(todo.updatedAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}</time><button type="button" className="todo-delete" onClick={() => onChange(todos.filter((item) => item.id !== todo.id))} aria-label={`${todo.title} 삭제`}><Trash2 size={15} /></button></article>)}{visible.length === 0 && <div className="todo-empty"><ListTodo size={27} /><strong>{filter === "done" ? "완료한 일이 없습니다" : "등록된 할 일이 없습니다"}</strong><p>위 입력창에서 새로운 할 일을 추가하세요.</p></div>}</div>
  </section>;
}

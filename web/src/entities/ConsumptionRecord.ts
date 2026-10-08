import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity({ name: "consumption_records" })
@Unique("uq_user_week", ["userId", "weekStart"])
export class ConsumptionRecord {
  @PrimaryGeneratedColumn({ name: "record_id", type: "int", unsigned: true }) recordId!: number;
  @Column({ name: "user_id", type: "int", unsigned: true }) userId!: number;
  @Column({ name: "week_start", type: "date" }) weekStart!: string;
  @Column({ name: "units_consumed", type: "decimal", precision: 10, scale: 2 }) unitsConsumed!: number;
  @Column({ name: "bill_amount", type: "decimal", precision: 10, scale: 2, nullable: true }) billAmount!: number | null;
  @CreateDateColumn({ name: "created_at", type: "datetime" }) createdAt!: Date;
}
